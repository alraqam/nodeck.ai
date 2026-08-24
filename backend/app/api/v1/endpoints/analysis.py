import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.startups import get_owned_startup
from app.db.session import AsyncSessionLocal
from app.models.report import Report, ReportStatus, ReportType
from app.models.startup import Startup
from app.models.user import User
from app.schemas.report import AnalysisTriggerResponse, ReportOut
from app.schemas.startup import StartupIntelligenceProfile
from app.services.ai import ai_service

logger = logging.getLogger(__name__)
router = APIRouter()

# The analysis costs a real API call, so refuse to run it on a profile with
# nothing in it. `if not sip_data` alone is not enough: {"identity": {}} is
# truthy and would sail straight through.
REQUIRED_FOR_ANALYSIS = [
    (("problem", "description"), "Problem description"),
    (("solution", "description"), "Solution description"),
    (("market", "tam"), "Market TAM"),
]


def _missing_sections(sip_data: Optional[dict]) -> list[str]:
    sip_data = sip_data or {}
    missing = []
    for (section, field), label in REQUIRED_FOR_ANALYSIS:
        value = (sip_data.get(section) or {}).get(field)
        if value in (None, "", [], {}):
            missing.append(label)
    return missing


async def _finish_report(report_id: uuid.UUID, status_value: str, content: dict) -> None:
    """Write the terminal state in its own session.

    The failure path must not reuse the session the analysis ran under: once a
    transaction has errored, further statements on it are rejected, so the
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
        db.add(report)
        await db.commit()


async def process_fundability_analysis(
    report_id: uuid.UUID, sip_data: dict, name: str, one_liner: Optional[str]
) -> None:
    try:
        sip = StartupIntelligenceProfile(**(sip_data or {}))
        analysis = await ai_service.analyze_fundability(sip, name, one_liner)
    except Exception:
        # Log the detail, store a generic message: str(exc) can carry an API key
        # fragment or a full DSN into a JSONB column the frontend renders.
        logger.exception("fundability analysis failed for report %s", report_id)
        await _finish_report(
            report_id,
            ReportStatus.FAILED.value,
            {"error": "Analysis failed. Please try again."},
        )
        return

    await _finish_report(
        report_id, ReportStatus.COMPLETED.value, analysis.model_dump(mode="json")
    )


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

    missing = _missing_sections(startup.sip_data)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Your Intelligence Profile is missing: "
                + ", ".join(missing)
                + ". Fill these in before running an analysis."
            ),
        )

    report = Report(
        startup_id=startup.id,
        type=ReportType.FUNDABILITY_SCORE.value,
        status=ReportStatus.PENDING.value,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(
        process_fundability_analysis,
        report.id,
        startup.sip_data,
        startup.name,
        startup.one_liner,
    )
    return {"report_id": report.id, "status": ReportStatus.PENDING.value}


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
