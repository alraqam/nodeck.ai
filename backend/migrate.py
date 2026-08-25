"""Additive schema migration.

Run manually:  python migrate.py

create_all() creates missing TABLES but silently ignores new COLUMNS on tables
that already exist, so adding a field to a model is invisible to a database
that already has rows in it. Until Alembic is adopted, new columns go here.

Every statement is IF NOT EXISTS, so running this twice is a no-op.
"""

import asyncio

from sqlalchemy import text

from app.db.base import Base  # noqa: F401  (registers every model on Base)
from app.db.session import engine

COLUMNS = [
    ("startups", "stage", "VARCHAR"),
    ("startups", "industry", "VARCHAR[]"),
    ("reports", "score_summary", "JSONB"),
    ("reports", "locked_at", "TIMESTAMPTZ"),
    ("reports", "attempts", "INTEGER NOT NULL DEFAULT 0"),
    ("investor_views", "locked_at", "TIMESTAMPTZ"),
    ("investor_views", "attempts", "INTEGER NOT NULL DEFAULT 0"),
]


async def main() -> None:
    async with engine.begin() as conn:
        # Creates investor_views; existing tables are left untouched.
        await conn.run_sync(Base.metadata.create_all)

        for table, column, coltype in COLUMNS:
            await conn.execute(
                text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "{column}" {coltype}')
            )
            print(f"  ok  {table}.{column} ({coltype})")

        # Backfill score_summary for reports scored before the column existed,
        # so history rows do not render as blank.
        result = await conn.execute(
            text(
                """
                UPDATE reports
                   SET score_summary = jsonb_build_object(
                           'total_score', content->'total_score',
                           'breakdown',   content->'breakdown')
                 WHERE score_summary IS NULL
                   AND status = 'COMPLETED'
                   AND type = 'FUNDABILITY_SCORE'
                   AND content ? 'total_score'
                """
            )
        )
        print(f"  backfilled score_summary on {result.rowcount} report(s)")

    await engine.dispose()
    print("migration complete")


if __name__ == "__main__":
    asyncio.run(main())
