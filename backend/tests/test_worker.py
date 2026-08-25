"""Tests for the durable job worker.

These run against the real database, because the thing worth testing is the
SQL: the claim has to be atomic, it has to reclaim jobs whose worker died, and
it must never hand the same row to two workers. None of that can be verified
against a mock.

Skipped automatically when no database is reachable, so the suite still runs
on a machine that only has Python.
"""

import asyncio
import uuid

import pytest
from sqlalchemy import text

from app.db.session import AsyncSessionLocal, engine
from app.models.report import ReportStatus
from app.services import worker

pytestmark = pytest.mark.asyncio(loop_scope="function")


async def _db_available() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@pytest.fixture(autouse=True)
async def fresh_engine_per_test():
    """Give every test its own connections.

    The engine is module-level and its pool binds to whichever event loop first
    used it. pytest-asyncio hands each test a new loop, so a pooled connection
    from an earlier test belongs to a dead loop and fails on reuse - which
    showed up as tests skipping at random rather than as an error.
    """
    await engine.dispose()
    if not await _db_available():
        pytest.skip("no database reachable")
    yield
    await engine.dispose()


@pytest.fixture
async def startup_id():
    """A throwaway founder and startup, removed afterwards."""
    uid, sid = uuid.uuid4(), uuid.uuid4()
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, full_name, role)"
                " VALUES (:id, :email, 'x', 'Worker Test', 'FOUNDER')"
            ),
            {"id": uid, "email": f"worker-test-{uid}@example.test"},
        )
        await db.execute(
            text(
                "INSERT INTO startups (id, founder_id, name, slug, sip_data)"
                " VALUES (:id, :founder, 'Worker Test Co', :slug, '{}')"
            ),
            {"id": sid, "founder": uid, "slug": f"worker-test-{sid}"},
        )
        await db.commit()

    yield sid

    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM reports WHERE startup_id = :s"), {"s": sid})
        await db.execute(
            text("DELETE FROM investor_views WHERE startup_id = :s"), {"s": sid}
        )
        await db.execute(text("DELETE FROM startups WHERE id = :s"), {"s": sid})
        await db.execute(text("DELETE FROM users WHERE id = :u"), {"u": uid})
        await db.commit()


async def _insert(startup_id, *, status="PENDING", locked_sql="NULL", attempts=0):
    job_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                f"""
                INSERT INTO reports
                    (id, startup_id, type, status, locked_at, attempts, created_at)
                VALUES
                    (:id, :s, 'FUNDABILITY_SCORE', :status, {locked_sql}, :attempts, now())
                """
            ),
            {"id": job_id, "s": startup_id, "status": status, "attempts": attempts},
        )
        await db.commit()
    return job_id


async def _row(job_id):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT status, attempts, locked_at FROM reports WHERE id = :id"),
            {"id": job_id},
        )
        return result.first()


class TestClaim:
    async def test_claims_a_waiting_job_and_counts_the_attempt(self, startup_id):
        job_id = await _insert(startup_id)

        async with AsyncSessionLocal() as db:
            claimed = await worker._claim(db, "reports")

        assert claimed is not None
        assert claimed.id == job_id
        assert claimed.attempts == 1

        row = await _row(job_id)
        assert row.locked_at is not None, "claiming must take the lease"

    async def test_ignores_a_job_with_a_live_lease(self, startup_id):
        await _insert(startup_id, locked_sql="now()")

        async with AsyncSessionLocal() as db:
            assert await worker._claim(db, "reports") is None

    async def test_reclaims_a_job_whose_lease_expired(self, startup_id):
        # Exactly the crashed-worker case: PENDING, lease taken, nobody running.
        job_id = await _insert(
            startup_id, locked_sql="now() - interval '1 hour'", attempts=1
        )

        async with AsyncSessionLocal() as db:
            claimed = await worker._claim(db, "reports")

        assert claimed is not None and claimed.id == job_id
        assert claimed.attempts == 2, "a reclaim counts as another attempt"

    @pytest.mark.parametrize("status", ["COMPLETED", "FAILED"])
    async def test_never_claims_a_finished_job(self, startup_id, status):
        await _insert(startup_id, status=status)

        async with AsyncSessionLocal() as db:
            assert await worker._claim(db, "reports") is None

    async def test_two_workers_never_get_the_same_job(self, startup_id):
        # The guarantee that makes running more than one worker safe.
        await _insert(startup_id)

        async def claim_once():
            async with AsyncSessionLocal() as db:
                return await worker._claim(db, "reports")

        first, second = await asyncio.gather(claim_once(), claim_once())
        claimed = [c for c in (first, second) if c is not None]

        assert len(claimed) == 1, "SKIP LOCKED must hand the row to exactly one worker"

    async def test_takes_the_oldest_job_first(self, startup_id):
        older = await _insert(startup_id)
        await asyncio.sleep(0.01)
        await _insert(startup_id)

        async with AsyncSessionLocal() as db:
            claimed = await worker._claim(db, "reports")

        assert claimed.id == older


class TestRecoverOrphans:
    async def test_releases_leases_left_by_a_dead_process(self, startup_id):
        job_id = await _insert(startup_id, locked_sql="now()", attempts=1)

        await worker.recover_orphans()

        row = await _row(job_id)
        assert row.locked_at is None
        assert row.status == ReportStatus.PENDING.value, "still work to do, not failed"

    async def test_fails_a_job_past_its_attempt_budget(self, startup_id):
        job_id = await _insert(
            startup_id, locked_sql="now()", attempts=worker.MAX_ATTEMPTS + 1
        )

        await worker.recover_orphans()

        row = await _row(job_id)
        assert row.status == ReportStatus.FAILED.value

    async def test_leaves_finished_jobs_alone(self, startup_id):
        job_id = await _insert(startup_id, status="COMPLETED", locked_sql="now()")

        await worker.recover_orphans()

        row = await _row(job_id)
        assert row.status == "COMPLETED"
        assert row.locked_at is not None, "a finished row is not the worker's business"
