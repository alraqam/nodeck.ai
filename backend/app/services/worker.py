"""A durable job worker backed by the database.

The problem this replaces: generation used to run in a FastAPI BackgroundTask,
which lives only in the process that accepted the request. A restart, a crash,
or a deploy mid-generation lost the work silently and left the report on
PENDING forever - a state nothing could move it out of, because no record of
the pending work existed anywhere but in memory.

Here the report row *is* the job record, so a claim is as durable as the data.
A worker claims a row by stamping `locked_at`; if that worker dies, the lease
goes stale and the next worker picks the job up again. Nothing is lost, and
nothing needs a broker: Postgres already gives us `FOR UPDATE SKIP LOCKED`,
which is exactly the primitive a queue needs.

Swapping this for ARQ or Celery later means replacing `_claim` and the loop -
the processing functions do not change.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.report import ReportStatus

logger = logging.getLogger(__name__)

# How often to look for work when the queue is empty. Generation takes tens of
# seconds, so a second of dispatch latency is not worth a tighter loop.
POLL_INTERVAL_SECONDS = 1.0

# How long a claim is honoured before another worker may take the job. Must
# exceed the slowest realistic generation, or a healthy worker's job gets
# stolen and run twice.
LEASE = timedelta(minutes=15)

# A job that has failed this many times is not going to succeed. Stopping is
# better than burning API spend on a profile that reliably breaks.
MAX_ATTEMPTS = 3

INTERRUPTED = (
    "This run was interrupted and could not be recovered. Please try again."
)
EXHAUSTED = "Generation failed repeatedly. Please try again later."


async def _claim(db: AsyncSession, table: str) -> Optional[Any]:
    """Atomically take ownership of one waiting job.

    A single statement both claims fresh work and reclaims jobs whose worker
    died, because both cases are "PENDING with no live lease". SKIP LOCKED lets
    several workers share the queue without blocking on each other or handing
    the same row to two of them.
    """
    result = await db.execute(
        text(
            f"""
            UPDATE {table} SET
                locked_at = now(),
                attempts  = attempts + 1
            WHERE id = (
                SELECT id FROM {table}
                 WHERE status = :pending
                   AND (locked_at IS NULL
                        OR locked_at < now() - make_interval(secs => :lease_seconds))
                 ORDER BY created_at
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
            )
            RETURNING id, attempts
            """
        ),
        {
            "pending": ReportStatus.PENDING.value,
            # Seconds, not a timedelta: in `now() - $1` Postgres cannot tell
            # whether $1 is an interval or a timestamptz, and resolves it the
            # wrong way. make_interval() makes the type explicit.
            "lease_seconds": LEASE.total_seconds(),
        },
    )
    row = result.first()
    await db.commit()
    return row


async def _abandon(db: AsyncSession, table: str, job_id, message: str) -> None:
    """Move a job to FAILED without another attempt."""
    await db.execute(
        text(
            f"""
            UPDATE {table}
               SET status = :failed, content = :content, locked_at = NULL
             WHERE id = :id
            """
        ),
        {
            "failed": ReportStatus.FAILED.value,
            "content": f'{{"error": "{message}"}}',
            "id": job_id,
        },
    )
    await db.commit()


async def _run_queue(
    table: str,
    process: Callable[[Any], Awaitable[None]],
) -> None:
    """Claim and process jobs from one table until cancelled."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                row = await _claim(db, table)

            if row is None:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue

            job_id, attempts = row.id, row.attempts

            if attempts > MAX_ATTEMPTS:
                logger.warning("%s %s exhausted after %s attempts", table, job_id, attempts)
                async with AsyncSessionLocal() as db:
                    await _abandon(db, table, job_id, EXHAUSTED)
                continue

            logger.info("%s %s claimed (attempt %s)", table, job_id, attempts)
            await process(job_id)

        except asyncio.CancelledError:
            # Shutdown. Leave locked_at set: the lease will expire and another
            # worker - or this one after a restart - reclaims the job.
            logger.info("worker for %s stopping", table)
            raise
        except Exception:
            # A failure in the loop itself must never kill the worker, or the
            # queue silently stops draining for the process lifetime.
            logger.exception("worker loop error on %s", table)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


async def recover_orphans() -> int:
    """Release leases held by workers that no longer exist.

    Called once at startup. Without it, a job interrupted by a restart waits a
    full lease period before anyone retries it, which the founder experiences
    as the report simply hanging.

    This assumes a single application process, which is what the MVP runs. With
    several processes the unconditional clear could steal a live job, so this
    becomes lease-only recovery the moment the app is scaled out.
    """
    released = 0
    async with AsyncSessionLocal() as db:
        for table in ("reports", "investor_views"):
            result = await db.execute(
                text(
                    f"""
                    UPDATE {table} SET locked_at = NULL
                     WHERE status = :pending AND locked_at IS NOT NULL
                    """
                ),
                {"pending": ReportStatus.PENDING.value},
            )
            released += result.rowcount or 0

            # Anything already past its attempt budget is failed outright, so a
            # poisonous job cannot loop forever across restarts.
            await db.execute(
                text(
                    f"""
                    UPDATE {table}
                       SET status = :failed, content = :content, locked_at = NULL
                     WHERE status = :pending AND attempts > :max_attempts
                    """
                ),
                {
                    "pending": ReportStatus.PENDING.value,
                    "failed": ReportStatus.FAILED.value,
                    "content": f'{{"error": "{INTERRUPTED}"}}',
                    "max_attempts": MAX_ATTEMPTS,
                },
            )
        await db.commit()

    if released:
        logger.info("released %s orphaned job lease(s) at startup", released)
    return released


def start(
    process_report: Callable[[Any], Awaitable[None]],
    process_view: Callable[[Any], Awaitable[None]],
) -> list[asyncio.Task]:
    """Launch one worker per queue. Returns the tasks so shutdown can cancel them."""
    return [
        asyncio.create_task(_run_queue("reports", process_report), name="worker:reports"),
        asyncio.create_task(
            _run_queue("investor_views", process_view), name="worker:investor_views"
        ),
    ]


async def stop(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
