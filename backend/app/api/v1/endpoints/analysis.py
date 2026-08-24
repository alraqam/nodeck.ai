import logging
import uuid
from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
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
REQUIRED_FOR_ANALYSIS = [
    (("problem", "description"), "Problem description"),
    (("solution", "description"), "Solution description"),
    (("market", "tam"), "Market TAM"),
]

GENERIC_FAILURE = "Generation failed. Please try again."


def _missing_sections(sip_data: Optional[dict]) -> list[str]:
    sip_data = sip_data or {}
    missing = []
    for (section, field), label in REQUIRED_FOR_ANALYSIS:
        value = (sip_data.get(section) or {}).get(field)
        if value in (None, "", [], {}):
            missing.append(label)
    return missing


def _require_complete_sip(startup: Startup) -> None:
    missing = _missing_sections(startup.sip_data)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your Intelligence Profile is missing: "
                + ", ".join(missing)
                + ". Fill these in before running this."
            ),
        )


async def _finish_report(
    report_id: uuid.UUID,
    status_value: str,
    content: dict,
    score_summary: Optional[dict] = None,
) -> None:
    """Write the terminal state in its own session.

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
        if score_summary is not None:
            report.score_summary = score_summary
        db.add(report)
        await db.commit()


async def process_report(
    report_id: uuid.UUID,
    generate: Callable[[StartupIntelligenceProfile], Awaitable[Any]],
    sip_data: dict,
    kind: str,
) -> None:
    """Run one generation and record its outcome.

    Shared by all three report types: they differ only in which AI call runs
    and whether a score falls out of the result, so the transaction handling,
    error masking and PENDING-resolution live here once.
    """
    try:
        sip = StartupIntelligenceProfile(**(sip_data or {}))
        result = await generate(sip)
    except Exception:
        # Log the detail, store a generic message: str(exc) can carry an API
        # key fragment or a full DSN into a JSONB column the frontend renders.
        logger.exception("%s failed for report %s", kind, report_id)
        await _finish_report(report_id, ReportStatus.FAILED.value, {"error": GENERIC_FAILURE})
        return

    content = result.model_dump(mode="json")
    # Denormalised so the history list can show scores without loading every
    # full report body.
    summary = (
        {"total_score": content["total_score"], "breakdown": content["breakdown"]}
        if kind == ReportType.FUNDABILITY_SCORE.value
        else None
    )
    await _finish_report(report_id, ReportStatus.COMPLETED.value, content, summary)


async def _queue_report(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    startup: Startup,
    report_type: ReportType,
    generate: Callable[[StartupIntelligenceProfile], Awaitable[Any]],
) -> dict:
    report = Report(
        startup_id=startup.id,
        type=report_type.value,
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(
        process_report, report.id, generate, startup.sip_data, report_type.value
    )
    return {"report_id": report.id, "status": ReportStatus.PENDING.value}


@router.post(
    "/{startup_id}/fundability",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_fundability_analysis(
    startup_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue a fundability analysis. Poll GET /analysis/reports/{report_id}."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_complete_sip(startup)
    return await _queue_report(
        db,
        background_tasks,
        startup,
        ReportType.FUNDABILITY_SCORE,
        lambda sip: ai_service.analyze_fundability(sip, startup.name, startup.one_liner),
    )


@router.post(
    "/{startup_id}/memo",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_memo_generation(
    startup_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue an internal-style investment memo."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_complete_sip(startup)
    return await _queue_report(
        db,
        background_tasks,
        startup,
        ReportType.INVESTMENT_MEMO,
        lambda sip: ai_service.generate_memo(sip, startup.name, startup.one_liner),
    )


@router.post(
    "/{startup_id}/deck",
    response_model=AnalysisTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_deck_generation(
    startup_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Queue a pitch deck built FROM the profile - the deck as an output."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_complete_sip(startup)
    return await _queue_report(
        db,
        background_tasks,
        startup,
        ReportType.PITCH_DECK,
        lambda sip: ai_service.generate_deck(sip, startup.name, startup.one_liner),
    )


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


async def _finish_view(view_id: uuid.UUID, status_value: str, content: dict) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InvestorView).filter(InvestorView.id == view_id))
        view = result.scalars().first()
        if not view:
            logger.error("investor view %s vanished before it could be finalised", view_id)
            return
        view.status = status_value
        view.content = content
        db.add(view)
        await db.commit()


async def process_investor_view(
    view_id: uuid.UUID,
    sip_data: dict,
    name: str,
    investor_name: str,
    investor_thesis: Optional[str],
) -> None:
    try:
        sip = StartupIntelligenceProfile(**(sip_data or {}))
        result = await ai_service.generate_investor_view(
            sip, name, investor_name, investor_thesis
        )
    except Exception:
        logger.exception("investor view failed for %s", view_id)
        await _finish_view(view_id, ReportStatus.FAILED.value, {"error": GENERIC_FAILURE})
        return

    await _finish_view(view_id, ReportStatus.COMPLETED.value, result.model_dump(mode="json"))


@router.post(
    "/{startup_id}/investor-views",
    response_model=InvestorViewTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_investor_view(
    startup_id: uuid.UUID,
    view_in: InvestorViewCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Retell the profile for one investor's thesis."""
    startup = await get_owned_startup(db, startup_id, current_user)
    _require_complete_sip(startup)

    view = InvestorView(
        startup_id=startup.id,
        investor_name=view_in.investor_name,
        investor_thesis=view_in.investor_thesis,
        status=ReportStatus.PENDING.value,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)

    background_tasks.add_task(
        process_investor_view,
        view.id,
        startup.sip_data,
        startup.name,
        view.investor_name,
        view.investor_thesis,
    )
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
