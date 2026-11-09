import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("voxspec.database")

_pool: asyncpg.Pool | None = None


async def get_db_pool(settings: Settings | None = None) -> asyncpg.Pool:
    global _pool
    if _pool is None:
        if settings is None:
            settings = get_settings()
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30.0,
        )
        logger.info("Initialized PostgreSQL connection pool")
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Closed PostgreSQL connection pool")


@asynccontextmanager
async def user_transaction(
    user: AuthenticatedUser,
    settings: Settings | None = None,
) -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Acquires a database connection and sets the user's JWT context
    for the duration of the transaction so that Row-Level Security (RLS)
    is strictly enforced at the Postgres level.
    """
    pool = await get_db_pool(settings)
    async with pool.acquire() as conn, conn.transaction():
        # Set request.jwt.claim.sub and request.jwt.claims locally for this transaction
        user_id_str = str(user.user_id)
        claims_json = json.dumps(user.claims)
        await conn.execute(
            """
                SELECT set_config('request.jwt.claim.sub', $1, true),
                       set_config('request.jwt.claim.role', $2, true),
                       set_config('request.jwt.claims', $3, true);
                """,
            user_id_str,
            user.role,
            claims_json,
        )
        # Switch to authenticated role for RLS policy evaluation
        try:
            await conn.execute("SET LOCAL role = 'authenticated';")
        except asyncpg.PostgresError as e:
            logger.debug("Role authenticated skipped: %s", str(e))
        yield conn
