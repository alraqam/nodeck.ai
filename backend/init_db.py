"""Create the database schema.

Run manually:  python init_db.py

Deliberately not run on app startup: create_all silently ignores changes to
existing tables, and running it on every --reload would train you to believe a
migration happened when it did not. During the MVP a schema change means
dropping and recreating the database. Adopt Alembic once there is real data.
"""

import asyncio

from app.db.base import Base  # noqa: F401  (imports every model onto Base)
from app.db.session import engine


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Tables created:", ", ".join(sorted(Base.metadata.tables)))


if __name__ == "__main__":
    asyncio.run(main())
