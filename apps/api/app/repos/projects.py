"""
Project repository — CRUD against the `projects` table via asyncpg.
All queries run inside user_transaction() which sets RLS context.
"""
from __future__ import annotations

import uuid
from typing import Any

import asyncpg

from app.core.logging import get_logger

logger = get_logger("voxspec.repos.projects")


async def create_project(
    conn: asyncpg.Connection,
    *,
    owner_id: str,
    name: str,
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        INSERT INTO projects (id, owner_id, name)
        VALUES ($1, $2, $3)
        RETURNING id, owner_id, name, created_at, updated_at
        """,
        uuid.UUID(str(uuid.uuid4())),
        uuid.UUID(owner_id),
        name,
    )
    if row is None:
        raise RuntimeError("Project insert returned no row")
    return dict(row)


async def list_projects(
    conn: asyncpg.Connection,
    *,
    owner_id: str,
) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT id, owner_id, name, created_at, updated_at
        FROM projects
        WHERE owner_id = $1
        ORDER BY created_at DESC
        """,
        uuid.UUID(owner_id),
    )
    return [dict(r) for r in rows]


async def get_project(
    conn: asyncpg.Connection,
    *,
    project_id: str,
    owner_id: str,
) -> dict[str, Any] | None:
    row = await conn.fetchrow(
        """
        SELECT id, owner_id, name, created_at, updated_at
        FROM projects
        WHERE id = $1 AND owner_id = $2
        """,
        uuid.UUID(project_id),
        uuid.UUID(owner_id),
    )
    return dict(row) if row else None


async def delete_project(
    conn: asyncpg.Connection,
    *,
    project_id: str,
    owner_id: str,
) -> bool:
    """Delete project and cascade (FK ON DELETE CASCADE handles child rows)."""
    result = await conn.execute(
        "DELETE FROM projects WHERE id = $1 AND owner_id = $2",
        uuid.UUID(project_id),
        uuid.UUID(owner_id),
    )
    return bool(result == "DELETE 1")
