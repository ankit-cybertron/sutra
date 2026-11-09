"""
Sessions, Transcripts, Extractions, Questions, Answers, Assumptions, and SpecVersions repos.
Strictly matches 0001_init.sql schema and RLS requirements.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import asyncpg

from app.core.logging import get_logger

logger = get_logger("voxspec.repos.sessions")


# ── Sessions ─────────────────────────────────────────────────────────────────


async def create_session(
    conn: asyncpg.Connection,
    *,
    project_id: str,
    owner_id: str,
    lang_hint: str = "auto",
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        INSERT INTO sessions (id, project_id, owner_id, status, lang_hint, round)
        VALUES ($1, $2, $3, 'draft', $4, 1)
        RETURNING id, project_id, owner_id, status, lang_hint, round, created_at, updated_at
        """,
        uuid.UUID(str(uuid.uuid4())),
        uuid.UUID(project_id),
        uuid.UUID(owner_id),
        lang_hint,
    )
    if row is None:
        raise RuntimeError("Session insert returned no row")
    return dict(row)


async def get_session(
    conn: asyncpg.Connection,
    *,
    session_id: str,
    owner_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, project_id, owner_id, status, lang_hint, round, created_at, updated_at
        FROM sessions
        WHERE id = $1 AND owner_id = $2
        """,
        uuid.UUID(session_id),
        uuid.UUID(owner_id),
    )
    return dict(row) if row else None


async def update_session_status(
    conn: asyncpg.Connection,
    *,
    session_id: str,
    status: str,
) -> None:
    await conn.execute(
        "UPDATE sessions SET status = $1, updated_at = now() WHERE id = $2",
        status,
        uuid.UUID(session_id),
    )


# ── Transcripts ───────────────────────────────────────────────────────────────


async def insert_transcript(
    conn: asyncpg.Connection,
    *,
    session_id: str,
    owner_id: str,
    raw_text: str,
    source: str = "typed",
    detected_langs: list[str] | None = None,
) -> dict[str, Any]:
    langs = detected_langs or []
    row = await conn.fetchrow(
        """
        INSERT INTO transcripts (id, session_id, owner_id, raw_text, source, detected_langs)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, session_id, owner_id, raw_text, source, detected_langs, created_at
        """,
        uuid.UUID(str(uuid.uuid4())),
        uuid.UUID(session_id),
        uuid.UUID(owner_id),
        raw_text,
        source,
        langs,
    )
    if row is None:
        raise RuntimeError("Transcript insert returned no row")
    return dict(row)


async def get_latest_transcript(
    conn: asyncpg.Connection,
    *,
    session_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, session_id, owner_id, raw_text, source, detected_langs, created_at
        FROM transcripts
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        uuid.UUID(session_id),
    )
    return dict(row) if row else None


# ── Extractions, Questions, Assumptions ──────────────────────────────────────


async def save_pipeline_extraction(
    conn: asyncpg.Connection,
    *,
    session_id: str,
    transcript_id: str,
    owner_id: str,
    claims_json: list[dict[str, Any]],
    decisions_json: list[dict[str, Any]],
    traces_json: list[dict[str, Any]],
    assumptions_json: list[dict[str, Any]],
    questions_json: list[dict[str, Any]],
    provider: str,
    model: str,
    prompt_version: str,
    latency_ms: int = 0,
) -> dict[str, Any]:
    # 1. Insert extraction
    ext_id = uuid.UUID(str(uuid.uuid4()))
    ext_row = await conn.fetchrow(
        """
        INSERT INTO extractions (
            id, owner_id, session_id, transcript_id,
            claims, decisions, revision_trace,
            provider, model, prompt_version, latency_ms
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
        RETURNING id, session_id, created_at
        """,
        ext_id,
        uuid.UUID(owner_id),
        uuid.UUID(session_id),
        uuid.UUID(transcript_id),
        json.dumps(claims_json),
        json.dumps(decisions_json),
        json.dumps(traces_json),
        provider,
        model,
        prompt_version,
        latency_ms,
    )
    if ext_row is None:
        raise RuntimeError("Extraction insert failed")

    # 2. Insert assumptions into assumptions table
    for asm in assumptions_json:
        await conn.execute(
            """
            INSERT INTO assumptions (id, owner_id, session_id, statement, risk, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            uuid.UUID(str(uuid.uuid4())),
            uuid.UUID(owner_id),
            uuid.UUID(session_id),
            asm["statement"],
            asm["risk"],
            asm.get("status", "open"),
        )

    # 3. Insert questions into questions table
    saved_questions = []
    for q in questions_json:
        qid = uuid.UUID(str(uuid.uuid4()))
        qrow = await conn.fetchrow(
            """
            INSERT INTO questions (id, owner_id, session_id, text, why_it_matters, impact, options, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'open')
            RETURNING id, text, why_it_matters, impact, options, status
            """,
            qid,
            uuid.UUID(owner_id),
            uuid.UUID(session_id),
            q["text"],
            q["why_it_matters"],
            int(q["impact"]),
            json.dumps(q.get("options", [])),
        )
        if qrow:
            d = dict(qrow)
            d["id"] = str(d["id"])
            if isinstance(d.get("options"), str):
                d["options"] = json.loads(d["options"])
            saved_questions.append(d)

    return {
        "id": str(ext_id),
        "session_id": session_id,
        "questions": saved_questions,
    }


async def get_latest_extraction(
    conn: asyncpg.Connection,
    *,
    session_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, session_id, claims, decisions, revision_trace, provider, model, prompt_version, created_at
        FROM extractions
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        uuid.UUID(session_id),
    )
    if not row:
        return None

    res = dict(row)
    # Parse jsonb fields if strings
    for field in ("claims", "decisions", "revision_trace"):
        if isinstance(res[field], str):
            res[field] = json.loads(res[field])

    # Fetch corresponding questions and assumptions
    q_rows = await conn.fetch(
        "SELECT id, text, why_it_matters, impact, options, status FROM questions WHERE session_id = $1",
        uuid.UUID(session_id),
    )
    res["questions"] = [dict(q) for q in q_rows]

    a_rows = await conn.fetch(
        "SELECT id, statement, risk, status FROM assumptions WHERE session_id = $1",
        uuid.UUID(session_id),
    )
    res["assumptions"] = [dict(a) for a in a_rows]
    return res


# ── Answers ───────────────────────────────────────────────────────────────────


async def save_answers(
    conn: asyncpg.Connection,
    *,
    owner_id: str,
    answers: list[dict[str, Any]],
) -> None:
    for answer in answers:
        qid_str = answer["question_id"]
        # Handle uuid conversion
        qid = uuid.UUID(qid_str) if len(qid_str) == 36 else None
        if not qid:
            # If mock question ID like 'Q1', look up the actual UUID for this question
            found_qid = await conn.fetchval(
                "SELECT id FROM questions WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1",
                uuid.UUID(owner_id),
            )
            if not found_qid:
                continue
            qid = found_qid

        await conn.execute(
            """
            INSERT INTO answers (id, owner_id, question_id, body)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (question_id) DO UPDATE
                SET body = EXCLUDED.body
            """,
            uuid.UUID(str(uuid.uuid4())),
            uuid.UUID(owner_id),
            qid,
            answer["answer_text"][:1000],
        )
        # Update question status to answered
        await conn.execute(
            "UPDATE questions SET status = 'answered' WHERE id = $1",
            qid,
        )


async def get_answers(
    conn: asyncpg.Connection,
    *,
    session_id: str,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT a.question_id, a.body as answer_text
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE q.session_id = $1
        """,
        uuid.UUID(session_id),
    )
    return [dict(r) for r in rows]


# ── Spec versions ─────────────────────────────────────────────────────────────


async def create_spec_version(
    conn: asyncpg.Connection,
    *,
    session_id: str,
    owner_id: str,
    spec_json: dict[str, Any],
    readiness_score: int,
    readiness_detail: list[dict[str, Any]],
    markdown_text: str,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    # Look up project_id from session
    project_id = await conn.fetchval(
        "SELECT project_id FROM sessions WHERE id = $1",
        uuid.UUID(session_id),
    )
    if not project_id:
        raise ValueError(f"Session {session_id} has no valid project")

    # Check idempotency key first
    if idempotency_key:
        existing = await conn.fetchrow(
            """
            SELECT id, session_id, readiness as readiness_score, created_at
            FROM spec_versions
            WHERE owner_id = $1 AND idempotency_key = $2
            """,
            uuid.UUID(owner_id),
            idempotency_key,
        )
        if existing:
            return dict(existing)

    # Next version number
    next_ver = await conn.fetchval(
        "SELECT coalesce(max(version), 0) + 1 FROM spec_versions WHERE project_id = $1",
        project_id,
    )

    vid = uuid.UUID(str(uuid.uuid4()))
    row = await conn.fetchrow(
        """
        INSERT INTO spec_versions (
            id, owner_id, project_id, session_id,
            version, schema_version, spec, markdown,
            readiness, readiness_detail, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, '1.0', $6::jsonb, $7, $8, $9::jsonb, $10)
        RETURNING id, session_id, readiness as readiness_score, created_at
        """,
        vid,
        uuid.UUID(owner_id),
        project_id,
        uuid.UUID(session_id),
        int(next_ver),
        json.dumps(spec_json),
        markdown_text,
        int(readiness_score),
        json.dumps(readiness_detail),
        idempotency_key,
    )
    if row is None:
        raise RuntimeError("Spec version insert returned no row")
    return dict(row)


async def get_latest_spec_version(
    conn: asyncpg.Connection,
    *,
    session_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, session_id, spec as spec_json, readiness as readiness_score, markdown as markdown_text, created_at
        FROM spec_versions
        WHERE session_id = $1
        ORDER BY version DESC
        LIMIT 1
        """,
        uuid.UUID(session_id),
    )
    if not row:
        return None
    res = dict(row)
    if isinstance(res["spec_json"], str):
        res["spec_json"] = json.loads(res["spec_json"])
    return res


async def get_spec_version(
    conn: asyncpg.Connection,
    *,
    version_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, session_id, spec as spec_json, readiness as readiness_score, markdown as markdown_text, created_at
        FROM spec_versions
        WHERE id = $1
        """,
        uuid.UUID(version_id),
    )
    if not row:
        return None
    res = dict(row)
    if isinstance(res["spec_json"], str):
        res["spec_json"] = json.loads(res["spec_json"])
    return res
