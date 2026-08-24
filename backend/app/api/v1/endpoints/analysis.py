from typing import Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.startup import Startup
from app.models.report import Report, ReportType, ReportStatus
from app.models.user import User
from app.services.ai import ai_service
from app.schemas.startup import StartupIntelligenceProfile

router = APIRouter()

async def process_fundability_analysis(report_id: str, sip_data: dict, db_session_factory):
    # Create a new session for the background task
    async with db_session_factory() as db:
        try:
            sip = StartupIntelligenceProfile(**sip_data)
            analysis = await ai_service.analyze_fundability(sip)
            
            # Update Report
            result = await db.execute(select(Report).filter(Report.id == report_id))
            report = result.scalars().first()
            if report:
                report.content = analysis.model_dump()
                report.status = ReportStatus.COMPLETED
                db.add(report)
                await db.commit()
        except Exception as e:
            print(f"Error processing analysis: {e}")
            result = await db.execute(select(Report).filter(Report.id == report_id))
            report = result.scalars().first()
            if report:
                report.status = ReportStatus.FAILED
                report.content = {"error": str(e)}
                db.add(report)
                await db.commit()

@router.post("/{startup_id}/fundability", status_code=202)
async def trigger_fundability_analysis(
    startup_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Trigger a fundability analysis in the background.
    """
    # Verify ownership
    result = await db.execute(select(Startup).filter(Startup.id == startup_id))
    startup = result.scalars().first()
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if startup.founder_id != current_user.id:
         raise HTTPException(status_code=400, detail="Not enough permissions")

    if not startup.sip_data:
        raise HTTPException(status_code=400, detail="Startup Profile is empty. Please fill it first.")

    # Create Pending Report
    report = Report(
        startup_id=startup.id,
        type=ReportType.FUNDABILITY_SCORE,
        status=ReportStatus.PENDING
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Trigger Background Task
    # Note: passing db session directly to background task is bad practice as it closes.
    # We pass the factory/logic to open a new one, or just needed data.
    # Here we pass the data and will open a fresh session in the worker function.
    # We need to import the sessionmaker from somewhere globally accessible or pass it.
    from app.db.session import AsyncSessionLocal
    background_tasks.add_task(process_fundability_analysis, report.id, startup.sip_data, AsyncSessionLocal)

    return {"report_id": report.id, "status": "PENDING"}

@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(select(Report).filter(Report.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return report
