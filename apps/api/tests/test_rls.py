import uuid

import asyncpg
import pytest

from app.core.auth import AuthenticatedUser
from app.core.config import Settings
from app.repos.database import close_db_pool, user_transaction

DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


@pytest.fixture
def test_settings():
    return Settings(
        DATABASE_URL=DATABASE_URL,
        SUPABASE_JWT_AUDIENCE="authenticated",
    )


@pytest.fixture(autouse=True)
async def cleanup_pool():
    yield
    await close_db_pool()


@pytest.fixture
async def user_a(test_settings):
    uid = uuid.uuid4()
    conn = await asyncpg.connect(test_settings.DATABASE_URL)
    try:
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, "user_a@example.com")
    finally:
        await conn.close()
    return AuthenticatedUser(
        user_id=uid,
        email="user_a@example.com",
        role="authenticated",
        claims={"sub": str(uid), "email": "user_a@example.com"},
    )


@pytest.fixture
async def user_b(test_settings):
    uid = uuid.uuid4()
    conn = await asyncpg.connect(test_settings.DATABASE_URL)
    try:
        await conn.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", uid, "user_b@example.com")
    finally:
        await conn.close()
    return AuthenticatedUser(
        user_id=uid,
        email="user_b@example.com",
        role="authenticated",
        claims={"sub": str(uid), "email": "user_b@example.com"},
    )


@pytest.mark.asyncio
async def test_projects_rls_isolation(test_settings, user_a, user_b):
    project_id = uuid.uuid4()
    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute(
            "INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)",
            project_id, user_a.user_id, "User A Project"
        )
        row = await conn.fetchrow("SELECT id, name FROM projects WHERE id = $1", project_id)
        assert row is not None
        assert row["name"] == "User A Project"

    # User B cannot see User A's project
    async with user_transaction(user_b, test_settings) as conn:
        row = await conn.fetchrow("SELECT id, name FROM projects WHERE id = $1", project_id)
        assert row is None
        all_rows = await conn.fetch("SELECT * FROM projects")
        assert not any(r["id"] == project_id for r in all_rows)

        # User B cannot update User A's project
        res = await conn.execute("UPDATE projects SET name = 'Hacked' WHERE id = $1", project_id)
        assert res == "UPDATE 0"

        # User B cannot delete User A's project
        res = await conn.execute("DELETE FROM projects WHERE id = $1", project_id)
        assert res == "DELETE 0"

    # Verify project is unchanged
    async with user_transaction(user_a, test_settings) as conn:
        row = await conn.fetchrow("SELECT name FROM projects WHERE id = $1", project_id)
        assert row["name"] == "User A Project"


@pytest.mark.asyncio
async def test_sessions_cross_user_denial_and_parent_check(test_settings, user_a, user_b):
    project_a = uuid.uuid4()
    session_a = uuid.uuid4()

    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute(
            "INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)",
            project_a, user_a.user_id, "Project A"
        )
        await conn.execute(
            "INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)",
            session_a, user_a.user_id, project_a
        )

    # User B cannot select session A
    async with user_transaction(user_b, test_settings) as conn:
        row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_a)
        assert row is None

        # User B cannot insert session pointing at User A's project
        session_b_bad = uuid.uuid4()
        with pytest.raises(asyncpg.RaiseError, match="owner mismatch with parent projects"):
            await conn.execute(
                "INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)",
                session_b_bad, user_b.user_id, project_a
            )


@pytest.mark.asyncio
async def test_transcripts_and_extractions_rls(test_settings, user_a, user_b):
    project_a = uuid.uuid4()
    session_a = uuid.uuid4()
    transcript_a = uuid.uuid4()
    extraction_a = uuid.uuid4()

    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute("INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)", project_a, user_a.user_id, "PA")
        await conn.execute("INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)", session_a, user_a.user_id, project_a)
        await conn.execute(
            "INSERT INTO transcripts (id, owner_id, session_id, raw_text) VALUES ($1, $2, $3, $4)",
            transcript_a, user_a.user_id, session_a, "Dictated ramble text here"
        )
        await conn.execute(
            """
            INSERT INTO extractions (id, owner_id, session_id, transcript_id, claims, decisions, revision_trace, provider, model, prompt_version)
            VALUES ($1, $2, $3, $4, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'fake', 'fake-v1', '1.0')
            """,
            extraction_a, user_a.user_id, session_a, transcript_a
        )

    # User B cannot select User A's transcript or extraction
    async with user_transaction(user_b, test_settings) as conn:
        assert await conn.fetchrow("SELECT * FROM transcripts WHERE id = $1", transcript_a) is None
        assert await conn.fetchrow("SELECT * FROM extractions WHERE id = $1", extraction_a) is None

        # User B cannot attach transcript to User A's session
        with pytest.raises(asyncpg.RaiseError, match="owner mismatch with parent sessions"):
            await conn.execute(
                "INSERT INTO transcripts (id, owner_id, session_id, raw_text) VALUES ($1, $2, $3, $4)",
                uuid.uuid4(), user_b.user_id, session_a, "Tampering attempt"
            )


@pytest.mark.asyncio
async def test_questions_and_answers_rls(test_settings, user_a, user_b):
    project_a = uuid.uuid4()
    session_a = uuid.uuid4()
    question_a = uuid.uuid4()
    answer_a = uuid.uuid4()

    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute("INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)", project_a, user_a.user_id, "PA")
        await conn.execute("INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)", session_a, user_a.user_id, project_a)
        await conn.execute(
            "INSERT INTO questions (id, owner_id, session_id, text, why_it_matters, impact) VALUES ($1, $2, $3, $4, $5, 1)",
            question_a, user_a.user_id, session_a, "What auth provider?", "Affects database"
        )
        await conn.execute(
            "INSERT INTO answers (id, owner_id, question_id, body) VALUES ($1, $2, $3, $4)",
            answer_a, user_a.user_id, question_a, "Supabase magic link"
        )

    # User B cannot read question or answer
    async with user_transaction(user_b, test_settings) as conn:
        assert await conn.fetchrow("SELECT * FROM questions WHERE id = $1", question_a) is None
        assert await conn.fetchrow("SELECT * FROM answers WHERE id = $1", answer_a) is None

        # User B cannot answer User A's question
        with pytest.raises(asyncpg.RaiseError, match="owner mismatch with parent questions"):
            await conn.execute(
                "INSERT INTO answers (id, owner_id, question_id, body) VALUES ($1, $2, $3, $4)",
                uuid.uuid4(), user_b.user_id, question_a, "Malicious answer"
            )


@pytest.mark.asyncio
async def test_assumptions_and_spec_versions_rls(test_settings, user_a, user_b):
    project_a = uuid.uuid4()
    session_a = uuid.uuid4()
    assumption_a = uuid.uuid4()
    spec_v_a = uuid.uuid4()

    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute("INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)", project_a, user_a.user_id, "PA")
        await conn.execute("INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)", session_a, user_a.user_id, project_a)
        await conn.execute(
            "INSERT INTO assumptions (id, owner_id, session_id, statement, risk) VALUES ($1, $2, $3, $4, 'low')",
            assumption_a, user_a.user_id, session_a, "Assumption text"
        )
        await conn.execute(
            """
            INSERT INTO spec_versions (id, owner_id, project_id, session_id, version, spec, markdown, readiness, readiness_detail)
            VALUES ($1, $2, $3, $4, 1, '{"title":"Clinic"}'::jsonb, '# Clinic', 85, '[]'::jsonb)
            """,
            spec_v_a, user_a.user_id, project_a, session_a
        )

    # User B cannot read assumption or spec_version
    async with user_transaction(user_b, test_settings) as conn:
        assert await conn.fetchrow("SELECT * FROM assumptions WHERE id = $1", assumption_a) is None
        assert await conn.fetchrow("SELECT * FROM spec_versions WHERE id = $1", spec_v_a) is None

        # User B cannot inject spec version pointing to User A's project
        with pytest.raises(asyncpg.RaiseError, match="owner mismatch with parent projects"):
            await conn.execute(
                """
                INSERT INTO spec_versions (id, owner_id, project_id, session_id, version, spec, markdown, readiness, readiness_detail)
                VALUES ($1, $2, $3, $4, 2, '{"title":"Exploit"}'::jsonb, '# Exploit', 90, '[]'::jsonb)
                """,
                uuid.uuid4(), user_b.user_id, project_a, session_a
            )

    # Immutability check: Owner A cannot update spec_version content
    async with user_transaction(user_a, test_settings) as conn:
        with pytest.raises(asyncpg.RaiseError, match="spec_versions rows are immutable"):
            await conn.execute(
                "UPDATE spec_versions SET markdown = '# Modified' WHERE id = $1",
                spec_v_a
            )


@pytest.mark.asyncio
async def test_exports_rls(test_settings, user_a, user_b):
    project_a = uuid.uuid4()
    session_a = uuid.uuid4()
    spec_v_a = uuid.uuid4()
    export_a = uuid.uuid4()

    async with user_transaction(user_a, test_settings) as conn:
        await conn.execute("INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)", project_a, user_a.user_id, "PA")
        await conn.execute("INSERT INTO sessions (id, owner_id, project_id) VALUES ($1, $2, $3)", session_a, user_a.user_id, project_a)
        await conn.execute(
            """
            INSERT INTO spec_versions (id, owner_id, project_id, session_id, version, spec, markdown, readiness, readiness_detail)
            VALUES ($1, $2, $3, $4, 1, '{}'::jsonb, '# M', 80, '[]'::jsonb)
            """,
            spec_v_a, user_a.user_id, project_a, session_a
        )
        await conn.execute(
            "INSERT INTO exports (id, owner_id, spec_version_id, format, agent) VALUES ($1, $2, $3, 'md', 'antigravity')",
            export_a, user_a.user_id, spec_v_a
        )

    # User B cannot see User A's export
    async with user_transaction(user_b, test_settings) as conn:
        assert await conn.fetchrow("SELECT * FROM exports WHERE id = $1", export_a) is None

        # User B cannot export User A's spec_version
        with pytest.raises(asyncpg.RaiseError, match="owner mismatch with parent spec_versions"):
            await conn.execute(
                "INSERT INTO exports (id, owner_id, spec_version_id, format, agent) VALUES ($1, $2, $3, 'zip', 'cursor')",
                uuid.uuid4(), user_b.user_id, spec_v_a
            )
