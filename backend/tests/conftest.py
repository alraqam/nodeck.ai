"""Test configuration.

The suite runs against its own database, created on demand.

This is not tidiness. The application runs a job worker that polls for PENDING
rows every second, so with tests pointed at the development database the live
worker races them: it claims the row a worker test just inserted, and the test
fails with nothing wrong in the code. Anything writing to shared tables has the
same problem in reverse - a test could hand the running app work to do.

The database name is set here, before anything imports app.core.config, because
Settings reads it at import time and the engine binds to it immediately.
"""

import asyncio
import os

TEST_DB = os.environ.get("POSTGRES_TEST_DB", "nodeck_test")
os.environ["POSTGRES_DB"] = TEST_DB

import pytest  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402


async def _ensure_database() -> bool:
    """Create the test database if it does not exist. False if unreachable."""
    import asyncpg

    dsn = (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/postgres"
    )
    try:
        conn = await asyncpg.connect(dsn)
    except Exception:
        return False

    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB
        )
        if not exists:
            # CREATE DATABASE cannot run inside a transaction, hence raw asyncpg
            # rather than the SQLAlchemy engine.
            await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        await conn.close()
    return True


async def _create_schema() -> None:
    from app.db.base import Base  # noqa: F401  (registers every model)
    from app.db.session import engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Mirrors migrate.py: create_all makes tables but not columns added to
        # tables it has already created, and a fresh test DB should still match
        # what a migrated production one looks like.
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_startups_share_token"
                " ON startups (share_token)"
            )
        )
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def test_database():
    """Stand up the schema once for the whole run."""
    if not asyncio.run(_ensure_database()):
        # Pure-logic tests still run; those needing a database skip themselves.
        return
    asyncio.run(_create_schema())
