"""
Pipeline Service — coordinates pipeline execution, stage timing, SSE events, and DB persistence.
Follows ARCHITECTURE.md: pipeline functions remain pure; I/O is managed here in services.
"""
from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from app.core.logging import get_logger
from app.llm.base import LLMProvider
from app.llm.fake import ClaimExtractionResult, GapAnalysisResult
from app.pipeline.normalize import normalize
from app.pipeline.render import render
from app.pipeline.resolve import resolve
from app.pipeline.score import score
from app.repos.database import user_transaction
from app.repos.sessions import (
    create_spec_version,
    get_answers,
    get_latest_extraction,
    get_latest_transcript,
    save_pipeline_extraction,
    update_session_status,
)
from app.schemas.spec import Spec
from prompts.extract_claims import (
    COMPILE_SPEC_SYSTEM,
    COMPILE_SPEC_USER,
    EXTRACT_CLAIMS_SYSTEM,
    EXTRACT_CLAIMS_USER,
    EXTRACT_CLAIMS_VERSION,
    GAP_ANALYSIS_SYSTEM,
    GAP_ANALYSIS_USER,
)

logger = get_logger("voxspec.services.pipeline")


def format_sse(event: str, data: dict[str, Any]) -> str:
    """Formats an event and data payload according to Server-Sent Events spec."""
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def stream_analyze(
    *,
    session_id: str,
    user_id: str,
    raw_text: str,
    llm: LLMProvider,
) -> AsyncGenerator[str, None]:
    """
    Executes analyze stages (normalize -> extract -> resolve -> gaps)
    and yields SSE stage events in real time.
    """
    total_start = time.perf_counter()

    # ── Stage 1: Normalize ──────────────────────────────────────────────────
    yield format_sse("stage", {"stage": "normalize", "status": "started"})
    s1_start = time.perf_counter()
    try:
        normalize(raw_text)
        s1_ms = int((time.perf_counter() - s1_start) * 1000)
        yield format_sse("stage", {"stage": "normalize", "status": "done", "ms": s1_ms})
    except Exception as exc:  # noqa: BLE001
        s1_ms = int((time.perf_counter() - s1_start) * 1000)
        yield format_sse("stage", {"stage": "normalize", "status": "failed", "error": str(exc), "ms": s1_ms})
        return

    # ── Stage 2: Extract Claims ─────────────────────────────────────────────
    yield format_sse("stage", {"stage": "extract", "status": "started"})
    s2_start = time.perf_counter()
    try:
        extraction_result: ClaimExtractionResult = await llm.structured(
            system=EXTRACT_CLAIMS_SYSTEM,
            user=EXTRACT_CLAIMS_USER.format(transcript=raw_text),
            schema=ClaimExtractionResult,
        )
        claims = extraction_result.claims
        s2_ms = int((time.perf_counter() - s2_start) * 1000)
        yield format_sse("stage", {"stage": "extract", "status": "done", "ms": s2_ms, "claims_count": len(claims)})
    except Exception as exc:  # noqa: BLE001
        s2_ms = int((time.perf_counter() - s2_start) * 1000)
        yield format_sse("stage", {"stage": "extract", "status": "failed", "error": str(exc), "ms": s2_ms})
        return

    # ── Stage 3: Resolve Intent ─────────────────────────────────────────────
    yield format_sse("stage", {"stage": "resolve", "status": "started"})
    s3_start = time.perf_counter()
    try:
        decisions, traces = resolve(claims)
        s3_ms = int((time.perf_counter() - s3_start) * 1000)
        yield format_sse("stage", {
            "stage": "resolve",
            "status": "done",
            "ms": s3_ms,
            "decisions_count": len(decisions),
            "traces_count": len(traces),
        })
    except Exception as exc:  # noqa: BLE001
        s3_ms = int((time.perf_counter() - s3_start) * 1000)
        yield format_sse("stage", {"stage": "resolve", "status": "failed", "error": str(exc), "ms": s3_ms})
        return

    # ── Stage 4: Gap Analysis ───────────────────────────────────────────────
    yield format_sse("stage", {"stage": "gaps", "status": "started"})
    s4_start = time.perf_counter()
    try:
        decisions_json_str = json.dumps([d.model_dump() for d in decisions], indent=2)
        gap_result: GapAnalysisResult = await llm.structured(
            system=GAP_ANALYSIS_SYSTEM,
            user=GAP_ANALYSIS_USER.format(decisions_json=decisions_json_str),
            schema=GapAnalysisResult,
        )
        # Cap questions at 3 high-impact questions per PRD
        capped_questions = sorted(gap_result.questions, key=lambda q: q.impact, reverse=True)[:3]
        s4_ms = int((time.perf_counter() - s4_start) * 1000)
        yield format_sse("stage", {
            "stage": "gaps",
            "status": "done",
            "ms": s4_ms,
            "assumptions_count": len(gap_result.assumptions),
            "questions_count": len(capped_questions),
        })
    except Exception as exc:  # noqa: BLE001
        s4_ms = int((time.perf_counter() - s4_start) * 1000)
        yield format_sse("stage", {"stage": "gaps", "status": "failed", "error": str(exc), "ms": s4_ms})
        return

    # ── Persist to Database ─────────────────────────────────────────────────
    claims_dict = [c.model_dump() for c in claims]
    decisions_dict = [d.model_dump() for d in decisions]
    traces_dict = [t.model_dump() for t in traces]
    assumptions_dict = [a.model_dump() for a in gap_result.assumptions]
    questions_dict = [q.model_dump() for q in capped_questions]

    async with user_transaction(user_id) as conn:
        t_row = await get_latest_transcript(conn, session_id=session_id)
        transcript_id = str(t_row["id"]) if t_row else str(uuid.uuid4())
        saved = await save_pipeline_extraction(
            conn,
            session_id=session_id,
            transcript_id=transcript_id,
            owner_id=user_id,
            claims_json=claims_dict,
            decisions_json=decisions_dict,
            traces_json=traces_dict,
            assumptions_json=assumptions_dict,
            questions_json=questions_dict,
            provider="groq",
            model="llama-3.3-70b-versatile",
            prompt_version=EXTRACT_CLAIMS_VERSION,
            latency_ms=int((time.perf_counter() - total_start) * 1000),
        )
        await update_session_status(conn, session_id=session_id, status="analyzed")

    total_ms = int((time.perf_counter() - total_start) * 1000)
    yield format_sse("complete", {
        "extraction_id": saved["id"],
        "session_id": session_id,
        "total_ms": total_ms,
        "decisions": decisions_dict,
        "traces": traces_dict,
        "assumptions": assumptions_dict,
        "questions": saved.get("questions", questions_dict),
    })


async def stream_compile(
    *,
    session_id: str,
    user_id: str,
    idempotency_key: str | None,
    llm: LLMProvider,
) -> AsyncGenerator[str, None]:
    """
    Executes compile stages (compile -> score -> render)
    and yields SSE stage events in real time.
    """
    total_start = time.perf_counter()

    # Load extraction and answers
    async with user_transaction(user_id) as conn:
        extraction = await get_latest_extraction(conn, session_id=session_id)
        if not extraction:
            yield format_sse("error", {"message": "Session has not been analyzed yet"})
            return

        answers_rows = await get_answers(conn, session_id=session_id)
        answers_dict = {str(a["question_id"]): a["answer_text"] for a in answers_rows}

    # ── Stage 1: Compile Spec ───────────────────────────────────────────────
    yield format_sse("stage", {"stage": "compile", "status": "started"})
    s1_start = time.perf_counter()
    try:
        user_prompt = COMPILE_SPEC_USER.format(
            decisions_json=json.dumps(extraction["decisions"], default=str),
            answers_json=json.dumps(answers_dict, default=str),
            assumptions_json=json.dumps(extraction["assumptions"], default=str),
        )
        spec: Spec = await llm.structured(
            system=COMPILE_SPEC_SYSTEM,
            user=user_prompt,
            schema=Spec,
        )
        s1_ms = int((time.perf_counter() - s1_start) * 1000)
        yield format_sse("stage", {"stage": "compile", "status": "done", "ms": s1_ms, "title": spec.title})
    except Exception as exc:  # noqa: BLE001
        s1_ms = int((time.perf_counter() - s1_start) * 1000)
        yield format_sse("stage", {"stage": "compile", "status": "failed", "error": str(exc), "ms": s1_ms})
        return

    # ── Stage 2: Readiness Score ────────────────────────────────────────────
    yield format_sse("stage", {"stage": "score", "status": "started"})
    s2_start = time.perf_counter()
    try:
        unanswered_count = max(0, len(extraction["questions"]) - len(answers_dict))
        readiness = score(spec, unanswered_questions_count=unanswered_count)
        s2_ms = int((time.perf_counter() - s2_start) * 1000)
        yield format_sse("stage", {
            "stage": "score",
            "status": "done",
            "ms": s2_ms,
            "score": readiness.score,
        })
    except Exception as exc:  # noqa: BLE001
        s2_ms = int((time.perf_counter() - s2_start) * 1000)
        yield format_sse("stage", {"stage": "score", "status": "failed", "error": str(exc), "ms": s2_ms})
        return

    # ── Stage 3: Render Markdown ────────────────────────────────────────────
    yield format_sse("stage", {"stage": "render", "status": "started"})
    s3_start = time.perf_counter()
    try:
        rendered_md = render(spec)
        s3_ms = int((time.perf_counter() - s3_start) * 1000)
        yield format_sse("stage", {"stage": "render", "status": "done", "ms": s3_ms})
    except Exception as exc:  # noqa: BLE001
        s3_ms = int((time.perf_counter() - s3_start) * 1000)
        yield format_sse("stage", {"stage": "render", "status": "failed", "error": str(exc), "ms": s3_ms})
        return

    # ── Persist to Database ─────────────────────────────────────────────────
    async with user_transaction(user_id) as conn:
        spec_version = await create_spec_version(
            conn,
            session_id=session_id,
            owner_id=user_id,
            spec_json=spec.model_dump(),
            readiness_score=readiness.score,
            readiness_detail=[b.model_dump() for b in readiness.breakdown],
            markdown_text=rendered_md,
            idempotency_key=idempotency_key,
        )
        await update_session_status(conn, session_id=session_id, status="compiled")

    total_ms = int((time.perf_counter() - total_start) * 1000)
    yield format_sse("complete", {
        "spec_version_id": spec_version["id"],
        "session_id": session_id,
        "readiness_score": readiness.score,
        "score_breakdown": [b.model_dump() for b in readiness.breakdown],
        "total_ms": total_ms,
        "markdown": rendered_md,
    })
