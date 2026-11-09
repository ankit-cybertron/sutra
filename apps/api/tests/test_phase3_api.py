"""
Phase 3 Integration Tests:
- Projects CRUD
- Sessions & Transcripts
- Analyze SSE stream
- Q&A answers submission
- Compile SSE stream with Idempotency-Key
- Spec version retrieval & markdown export
- Audio transcription endpoint (Gnani.ai / Fake STT)
- Rate limiting protection
"""

from __future__ import annotations

import io
import uuid
from collections.abc import AsyncGenerator

import asyncpg  # type: ignore[import-untyped]
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import Settings
from app.main import create_app
from app.repos.database import close_db_pool

TEST_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


@pytest.fixture(autouse=True)
async def cleanup_pool() -> AsyncGenerator[None, None]:
    yield
    await close_db_pool()


@pytest.fixture
def test_user() -> AuthenticatedUser:
    user_id = uuid.uuid4()
    return AuthenticatedUser(
        user_id=user_id,
        email="developer@voxspec.internal",
        role="authenticated",
        claims={"sub": str(user_id), "role": "authenticated"},
    )


@pytest.fixture
async def seeded_user(test_user: AuthenticatedUser) -> AsyncGenerator[AuthenticatedUser, None]:
    conn = await asyncpg.connect(TEST_DB_URL)
    try:
        await conn.execute(
            """
            INSERT INTO auth.users (id, email)
            VALUES ($1, $2)
            ON CONFLICT (id) DO NOTHING
            """,
            test_user.user_id,
            test_user.email,
        )
    finally:
        await conn.close()
    yield test_user


@pytest.fixture
def app_with_user(seeded_user: AuthenticatedUser):
    settings = Settings(
        DATABASE_URL=TEST_DB_URL,
        LLM_PROVIDER="fake",
        STT_PROVIDER="fake",
        RATE_LIMIT_ANALYZE_PER_MIN=10,
        RATE_LIMIT_COMPILE_PER_MIN=10,
    )
    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: seeded_user
    return app


@pytest.mark.asyncio
async def test_projects_crud(app_with_user) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app_with_user), base_url="http://test"
    ) as client:
        # 1. Create project
        create_resp = await client.post(
            "/v1/projects",
            json={"name": "Clinic Booking App"},
        )
        assert create_resp.status_code == 201
        proj = create_resp.json()
        assert proj["name"] == "Clinic Booking App"
        project_id = proj["id"]

        # 2. List projects
        list_resp = await client.get("/v1/projects")
        assert list_resp.status_code == 200
        projects = list_resp.json()
        assert any(p["id"] == project_id for p in projects)

        # 3. Get single project
        get_resp = await client.get(f"/v1/projects/{project_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == project_id

        # 4. Delete project
        del_resp = await client.delete(f"/v1/projects/{project_id}")
        assert del_resp.status_code == 204

        # 5. Verify deleted
        get_deleted = await client.get(f"/v1/projects/{project_id}")
        assert get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_full_pipeline_session_lifecycle(app_with_user) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app_with_user), base_url="http://test"
    ) as client:
        # 1. Create Project
        p_resp = await client.post("/v1/projects", json={"name": "Pipeline Project"})
        project_id = p_resp.json()["id"]

        # 2. Create Session
        s_resp = await client.post(f"/v1/projects/{project_id}/sessions")
        assert s_resp.status_code == 201
        session_id = s_resp.json()["id"]

        # 3. Save Transcript
        t_resp = await client.post(
            f"/v1/sessions/{session_id}/transcripts",
            json={
                "raw_text": "I want an appointment booking app for my clinic. Patients should pick a slot, then owner approves on WhatsApp. Ruko nahi, dashboard se bhi approve kar sakte hai.",
                "lang_hint": "mixed",
            },
        )
        assert t_resp.status_code == 200
        assert t_resp.json()["session_id"] == session_id

        # 4. Analyze Session via SSE
        analyze_resp = await client.post(f"/v1/sessions/{session_id}/analyze")
        assert analyze_resp.status_code == 200
        assert "text/event-stream" in analyze_resp.headers["content-type"]
        events = analyze_resp.text
        assert "normalize" in events
        assert "extract" in events
        assert "resolve" in events
        assert "gaps" in events
        assert "complete" in events

        # 5. Submit Answers
        ans_resp = await client.post(
            f"/v1/sessions/{session_id}/answers",
            json={
                "answers": [
                    {"question_id": "Q1", "answer_text": "Pay at clinic directly"},
                ]
            },
        )
        assert ans_resp.status_code == 200
        assert ans_resp.json()["status"] == "saved"

        # 6. Compile Spec via SSE (with Idempotency-Key)
        compile_resp = await client.post(
            f"/v1/sessions/{session_id}/compile",
            headers={"Idempotency-Key": "test-idemp-key-1"},
        )
        assert compile_resp.status_code == 200
        assert "text/event-stream" in compile_resp.headers["content-type"]
        compile_events = compile_resp.text
        assert "compile" in compile_events
        assert "score" in compile_events
        assert "render" in compile_events
        assert "complete" in compile_events

        # 7. Get Latest Spec
        spec_resp = await client.get(f"/v1/sessions/{session_id}/spec")
        assert spec_resp.status_code == 200
        spec_data = spec_resp.json()
        assert spec_data["readiness_score"] >= 0
        version_id = spec_data["id"]

        # 8. Export Spec Markdown
        export_resp = await client.get(f"/v1/spec-versions/{version_id}/export?format=md")
        assert export_resp.status_code == 200
        assert export_resp.headers["content-type"].startswith("text/markdown")
        assert "# " in export_resp.text


@pytest.mark.asyncio
async def test_audio_transcription_endpoint(app_with_user) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app_with_user), base_url="http://test"
    ) as client:
        # Create dummy WAV bytes
        dummy_wav = b"RIFF....WAVEfmt ...." + b"\x00" * 100
        files = {"file": ("recording.wav", io.BytesIO(dummy_wav), "audio/wav")}
        data = {"language_code": "mixed"}

        resp = await client.post("/v1/audio/transcribe", files=files, data=data)
        assert resp.status_code == 200
        res = resp.json()
        assert "text" in res
        assert len(res["text"]) > 0
        assert res["detected_lang"] in ("hi-Latn", "mixed", "en")


@pytest.mark.asyncio
async def test_analyze_rate_limiting(app_with_user) -> None:
    # Set limit to 2 per minute to test 429
    settings = Settings(
        DATABASE_URL=TEST_DB_URL,
        LLM_PROVIDER="fake",
        RATE_LIMIT_ANALYZE_PER_MIN=2,
    )
    user = AuthenticatedUser(
        user_id=uuid.uuid4(),
        email="ratelimited@voxspec.internal",
        role="authenticated",
        claims={},
    )
    # Seed user
    conn = await asyncpg.connect(TEST_DB_URL)
    await conn.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        user.user_id,
        user.email,
    )
    await conn.close()

    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create project, session, transcript
        p = (await client.post("/v1/projects", json={"name": "Rate Limit Proj"})).json()
        s = (await client.post(f"/v1/projects/{p['id']}/sessions")).json()
        await client.post(
            f"/v1/sessions/{s['id']}/transcripts",
            json={"raw_text": "Sample text for rate limit testing."},
        )

        # First request -> OK (200)
        r1 = await client.post(f"/v1/sessions/{s['id']}/analyze")
        assert r1.status_code == 200

        # Second request -> OK (200)
        r2 = await client.post(f"/v1/sessions/{s['id']}/analyze")
        assert r2.status_code == 200

        # Third request -> 429 (Rate limit reached)
        r3 = await client.post(f"/v1/sessions/{s['id']}/analyze")
        assert r3.status_code == 429
