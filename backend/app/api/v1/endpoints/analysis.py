import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.startups import get_owned_startup
from app.db.session import AsyncSessionLocal
from app.models.investor_view import InvestorView
from app.models.report import Report, ReportStatus, ReportType
from app.models.startup import Startup
from app.models.user import User
from app.schemas.report import (
    AnalysisTriggerResponse,
    InvestorViewCreate,
    InvestorViewOut,
    InvestorViewTriggerResponse,
    ReportOut,
)
from app.schemas.startup import StartupIntelligenceProfile
from app.services.ai import ai_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Every generation costs a real API call, so refuse to run one on a profile
# with nothing in it. `if not sip_data` alone is not enough: {"identity": {}}
# is truthy and would sail straight through.
#
# The bar is deliberately low: SOME description of the problem or the solution.
# It used to also demand a TAM, which is wrong twice over. Real decks routinely
# omit market sizing, so a cohort import would have been rejected wholesale on
# a field the deck never claimed. And the prompt already treats a missing TAM
# as a red flag - refusing to score it means the founder never hears that,
# which is the one thing they needed to know.
SCOREABLE_FIELDS = [
    (("problem", "description"), "a description of the problem"),
    (("solution", "description"), "a description of the solution"),
]

GENERIC_FAILURE = "Generation failed. Please try again."


def _has_text(sip_data: Optional[dict], section: str, field: str) -> bool:
    value = ((sip_data or {}).get(section) or {})
    if not isinstance(value, dict):
        return False
    text = value.get(field)
    # A stray space is not an answer.
    return bool(text) and bool(str(text).strip())


def _missing_sections(sip_data: Optional[dict]) -> list[str]:
    """What is missing, or [] if there is enough to score.

    Either field alone is enough. A profile with a problem but no solution is
    worth scoring - badly, and the report will say why.
    """
    if any(_has_text(sip_data, section, field) for (section, field), _ in SCOREABLE_FIELDS):
        return []
    return [label for _, label in SCOREABLE_FIELDS]


def _require_scoreable_sip(startup: Startup) -> None:
    missing = _missing_sections(startup.sip_data)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "There is nothing here to analyse yet. Add "
                + " or ".join(missing)
                + " first."
            ),
        )


# --- Job processing -------------------------------------------------------
#
# These are called by the worker (app/services/worker.py) with nothing but an
# id, so everything else is loaded here. That is deliberate: a job must be
# runnable from the row alone, or it could not survive the restart that
# in-memory background tasks did not.


async def _finish_report(
    report_id: uuid.UUID,
    status_value: str,
    content: dict,
    score_summary: Optional[dict] = None,
) -> None:
    """Write the terminal state in its own session, and release the lease.

    The failure path must not reuse the session the generation ran under: once
    a transaction has errored, further statements on it are rejected, so the
    FAILED write would silently never land and the report would sit at PENDING
    forever.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).filter(Report.id == report_id))
        report = result.scalars().first()
        if not report:
            logger.error("report %s vanished before it could be finalised", report_id)
            return
        report.status = status_value
        report.content = content
        report.locked_at = None
        if score_summary is not None:
            report.score_summary = score_summary
        db.add(report)
        await db.commit()


async def process_report(report_id: uuid.UUID) -> None:
    """Generate one report. Dispatches on the row's own type.

    Shared by all three report types: they differ only in which AI call runs
    and whether a score falls out of the result, so transaction handling, error
    masking and PENDING-resolution live here once.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Report, Startup)
            .join(Startup, Report.startup_id == Startup.id)
            .where(Report.id == report_id)
        )
        row = result.first()

    if row is None:
        logger.error("report %s no longer exists; nothing to generate", report_id)
        return

    report, startup = row
    kind = report.type

    try:
        sip = StartupIntelligenceProfile(**(startup.sip_data or {}))
        if kind == ReportType.FUNDABILITY_SCORE.value:
            result_model = await ai_service.analyze_fundability(
                sip, startup.name, startup.one_liner, startup.stage
            )
        elif kind == ReportType.INVESTMENT_MEMO.value:
            result_model = await ai_service.generate_memo(
                sip, startup.name, startup.one_liner
            )
        elif kind == ReportType.PITCH_DECK.value:
            result_model = await ai_service.generate_deck(
                sip, startup.name, startup.one_liner
            )
        else:
            logger.error("report %s has unknown type %r", report_id, kind)
            await _finish_report(
                report_id, ReportStatus.FAILED.value, {"error": GENERIC_FAILURE}
            )
            return
    except Exception:
        # Log the detail, store a generic message: str(exc) can carry an API
        # key fragment or a full DSN into a JSONB column the frontend renders.
        logger.exception("%s failed for report %s", kind, report_id)
        await _finish_report(
            report_id, ReportStatus.FAILED.value, {"error": GENERIC_FAILURE}
        )
        return

    content = result_model.model_dump(mode="json")
    # Denormalised so the history list and dashboard can show scores without
    # loading every full report body.
    summary = (
        {"total_score": content["total_score"], "breakdown": content["breakdown"]}
        if kind == ReportType.FUNDABILITY_SCORE.value
        else None
    )
    await _finish_report(report_id, ReportStatus.COMPLETED.value, content, summary)


async def _finish_view(view_id: uuid.UUID, status_value: str, content: dict) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InvestorView).filter(InvestorView.id == view_id))
        view = result.scalars().first()
        if not view:
            logger.error("investor view %s vanished before it could be finalised", view_id)
            return
        view.status = status_value
        view.content = content
        view.locked_at = None
        db.add(view)
        await db.commit()


async def process_investor_view(view_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InvestorView, Startup)
            .join(Startup, InvestorView.startup_id == Startup.id)
            .where(InvestorView.id == view_id)
        )
        row = result.first()

    if row is None:
        logger.error("investor view %s no longer exists", view_id)
        return

    view, startup = row
    try:
        sip = StartupIntelligenceProfile(**(startup.sip_data or {}))
        result_model = await ai_service.generate_investor_view(
            sip, startup.name, view.investor_name, view.investor_thesis
        )
    except Exception:
        logger.exception("investor view failed for %s", view_id)
        await _finish_view(view_id, ReportStatus.FAILED.value, {"error": GENERIC_FAILURE})
        return

    await _finish_view(
        view_id, ReportStatus.COMPLETED.value, result_model.model_dump(mode="json")
    )


# --- Enqueueing -----------------------------------------------------------


async def _enqueue_report(
    db: AsyncSession, startup: Startup, report_type: ReportType
) -> dict:
    """Create the PENDING row and return. The worker picks it up from there.

    Nothing is scheduled in-process on purpose - the row is the job, so the
    work survives this process dying a millisecond from now.
    """
    report = Report(
        startup_id=startup.id,
        type=report_type.value,
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {"report_id": report.id, "status": ReportStatus.PENDING.value}


@router.post(
    "/{startup_id}/fundability",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_fundability_analysis(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue a fundability analysis. Poll GET /analysis/reports/{report_id}."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_scoreable_sip(startup)
    return await _enqueue_report(db, startup, ReportType.FUNDABILITY_SCORE)


@router.post(
    "/{startup_id}/memo",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_memo_generation(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue an internal-style investment memo."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_scoreable_sip(startup)
    return await _enqueue_report(db, startup, ReportType.INVESTMENT_MEMO)


@router.post(
    "/{startup_id}/deck",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_deck_generation(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue a pitch deck built FROM the profile - the deck as an output."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_scoreable_sip(startup)
    return await _enqueue_report(db, startup, ReportType.PITCH_DECK)


@router.get("/reports/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    # Ownership is enforced in the query itself, so a report belonging to
    # another founder is indistinguishable from one that does not exist.
    result = await db.execute(
        select(Report)
        .join(Startup, Report.startup_id == Startup.id)
        .where(Report.id == report_id, Startup.founder_id == current_user.id)
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


# --- Investor views -------------------------------------------------------


@router.post(
    "/{startup_id}/investor-views",
    response_model=InvestorViewTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_investor_view(
    startup_id: uuid.UUID,
    view_in: InvestorViewCreate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Retell the profile for one investor's thesis."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_scoreable_sip(startup)

    view = InvestorView(
        startup_id=startup.id,
        investor_name=view_in.investor_name,
        investor_thesis=view_in.investor_thesis,
        status=ReportStatus.PENDING.value,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return {"view_id": view.id, "status": ReportStatus.PENDING.value}


@router.get("/{startup_id}/investor-views", response_model=list[InvestorViewOut])
async def list_investor_views(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    await get_owned_startup(db, startup_id, current_user)
    result = await db.execute(
        select(InvestorView)
        .where(InvestorView.startup_id == startup_id)
        .order_by(InvestorView.created_at.desc())
    )
    return result.scalars().all()


@router.get("/investor-views/{view_id}", response_model=InvestorViewOut)
async def get_investor_view(
    view_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(
        select(InvestorView)
        .join(Startup, InvestorView.startup_id == Startup.id)
        .where(InvestorView.id == view_id, Startup.founder_id == current_user.id)
    )
    view = result.scalars().first()
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="View not found")
    return view
