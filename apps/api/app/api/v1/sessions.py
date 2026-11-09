"""Sessions, Transcripts, Analysis, and Spec Compilation endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.rate_limit import check_rate_limit
from app.llm import LLMProvider, build_llm_provider
from app.repos.database import user_transaction
from app.repos.sessions import (
    create_session,
    get_latest_spec_version,
    get_latest_transcript,
    get_session,
    get_spec_version,
    insert_transcript,
    save_answers,
)
from app.schemas.api import (
    AnswersSubmit,
    SessionResponse,
    SpecVersionResponse,
    TranscriptCreate,
    TranscriptResponse,
)
from app.services.pipeline_service import stream_analyze, stream_compile

router = APIRouter(tags=["Sessions & Specs"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_llm(settings: AppSettings) -> LLMProvider:
    return build_llm_provider(settings)


CurrentLLM = Annotated[LLMProvider, Depends(get_llm)]


# ── Create Session ───────────────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_session(
    project_id: str,
    user: CurrentUser,
) -> dict[str, object]:
    async with user_transaction(user) as conn:
        session = await create_session(conn, project_id=project_id, owner_id=str(user.user_id))
        return session


# ── Upsert Transcript ────────────────────────────────────────────────────────

@router.post(
    "/sessions/{session_id}/transcripts",
    response_model=TranscriptResponse,
    status_code=status.HTTP_200_OK,
)
async def save_transcript(
    session_id: str,
    payload: TranscriptCreate,
    user: CurrentUser,
) -> dict[str, object]:
    async with user_transaction(user) as conn:
        session = await get_session(conn, session_id=session_id, owner_id=str(user.user_id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        transcript = await insert_transcript(
            conn,
            session_id=session_id,
            owner_id=str(user.user_id),
            raw_text=payload.raw_text,
            detected_langs=[payload.lang_hint],
        )
        return transcript


# ── Analyze Session (SSE Streaming) ──────────────────────────────────────────

@router.post("/sessions/{session_id}/analyze")
async def analyze_session(
    session_id: str,
    user: CurrentUser,
    settings: AppSettings,
    llm: CurrentLLM,
) -> StreamingResponse:
    # Rate limit check: RATE_LIMIT_ANALYZE_PER_MIN
    limit_key = f"analyze:{user.user_id}"
    if not check_rate_limit(limit_key, settings.RATE_LIMIT_ANALYZE_PER_MIN, window_s=60.0):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for session analysis. Please wait a minute.",
        )

    # Fetch transcript
    async with user_transaction(user) as conn:
        session = await get_session(conn, session_id=session_id, owner_id=str(user.user_id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        transcript_row = await get_latest_transcript(conn, session_id=session_id)
        if not transcript_row or not transcript_row.get("raw_text"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session has no transcript text to analyze",
            )
        raw_text = str(transcript_row["raw_text"])

    generator = stream_analyze(
        session_id=session_id,
        user_id=str(user.user_id),
        raw_text=raw_text,
        llm=llm,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Save Answers ─────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/answers", status_code=status.HTTP_200_OK)
async def submit_answers(
    session_id: str,
    payload: AnswersSubmit,
    user: CurrentUser,
) -> dict[str, str]:
    async with user_transaction(user) as conn:
        session = await get_session(conn, session_id=session_id, owner_id=str(user.user_id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        await save_answers(
            conn,
            owner_id=str(user.user_id),
            answers=[a.model_dump() for a in payload.answers],
        )
        return {"status": "saved"}


# ── Compile Spec (SSE Streaming) ─────────────────────────────────────────────

@router.post("/sessions/{session_id}/compile")
async def compile_session(
    session_id: str,
    user: CurrentUser,
    settings: AppSettings,
    llm: CurrentLLM,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> StreamingResponse:
    # Rate limit check: RATE_LIMIT_COMPILE_PER_MIN
    limit_key = f"compile:{user.user_id}"
    if not check_rate_limit(limit_key, settings.RATE_LIMIT_COMPILE_PER_MIN, window_s=60.0):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for spec compilation. Please wait a minute.",
        )

    async with user_transaction(user) as conn:
        session = await get_session(conn, session_id=session_id, owner_id=str(user.user_id))
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    generator = stream_compile(
        session_id=session_id,
        user_id=str(user.user_id),
        idempotency_key=idempotency_key,
        llm=llm,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Get Latest Spec ──────────────────────────────────────────────────────────

@router.get("/sessions/{session_id}/spec", response_model=SpecVersionResponse)
async def get_latest_spec(
    session_id: str,
    user: CurrentUser,
) -> dict[str, object]:
    async with user_transaction(user) as conn:
        spec_row = await get_latest_spec_version(conn, session_id=session_id)
        if not spec_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No spec version compiled for this session yet",
            )
        return spec_row


# ── Export Spec Version ───────────────────────────────────────────────────────

@router.get("/spec-versions/{version_id}/export")
async def export_spec(
    version_id: str,
    user: CurrentUser,
    format: str = "md",
) -> Response:
    async with user_transaction(user) as conn:
        spec_row = await get_spec_version(conn, version_id=version_id)
        if not spec_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Spec version not found",
            )

    if format == "md":
        markdown_content = spec_row.get("markdown_text", "")
        return Response(
            content=markdown_content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="SPEC-{version_id[:8]}.md"'},
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported export format: {format}. Supported: md",
    )
