import logging
import re
import uuid
from typing import Any, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Integer, delete
from sqlalchemy.future import select

from app.api import deps
from app.models.report import Report, ReportStatus, ReportType
from app.services.deck_parser import (
    DeckParseError,
    apply_parsed_deck,
    extract_pdf_text,
)
from app.services.ai import ai_service
from app.models.investor_view import InvestorView
from app.models.startup import Startup
from app.models.user import User
from app.schemas import startup as startup_schema
from app.schemas.report import DeckUploadResponse, ReportOut

logger = logging.getLogger(__name__)
router = APIRouter()

# Decks are slides, not books. 20MB is generous and keeps a hostile upload
# from parking a request worker on PDF extraction.
MAX_DECK_BYTES = 20 * 1024 * 1024


def _slugify(name: str) -> str:
    """Server-side slug: readable prefix plus a short random suffix.

    The suffix is what keeps `startups.slug` (globally unique) collision-free
    when two unrelated founders both name their company the same thing.
    """
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48] or "startup"
    return f"{base}-{uuid.uuid4().hex[:6]}"


async def get_owned_startup(
    db: AsyncSession, startup_id: uuid.UUID, user: User
) -> Startup:
    """Fetch a startup, or raise. 404 if it does not exist, 403 if it is not yours."""
    result = await db.execute(select(Startup).filter(Startup.id == startup_id))
    startup = result.scalars().first()
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
    if startup.founder_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return startup


@router.post("", response_model=startup_schema.Startup, status_code=status.HTTP_201_CREATED)
async def create_startup(
    *,
    db: AsyncSession = Depends(deps.get_db),
    startup_in: startup_schema.StartupCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Create a startup. The Intelligence Profile starts empty and is filled in
    afterwards via PUT /{startup_id}/sip."""
    startup = Startup(
        name=startup_in.name,
        slug=_slugify(startup_in.name),
        one_liner=startup_in.one_liner,
        stage=startup_in.stage,
        industry=startup_in.industry or None,
        founder_id=current_user.id,
        sip_data={},
    )
    db.add(startup)
    await db.commit()
    await db.refresh(startup)
    return startup


@router.get("", response_model=List[startup_schema.StartupSummary])
async def list_startups(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List the current user's startups, newest first, each with its latest score.

    The score comes from a single correlated subquery rather than a per-row
    lookup: rendering the dashboard should cost one round trip no matter how
    many startups the founder has.
    """
    latest_score = (
        select(Report.score_summary["total_score"].astext.cast(Integer))
        .where(
            Report.startup_id == Startup.id,
            Report.type == ReportType.FUNDABILITY_SCORE.value,
            Report.status == ReportStatus.COMPLETED.value,
            Report.score_summary.isnot(None),
        )
        .order_by(Report.created_at.desc())
        .limit(1)
        .correlate(Startup)
        .scalar_subquery()
    )

    result = await db.execute(
        select(Startup, latest_score.label("latest_score"))
        .filter(Startup.founder_id == current_user.id)
        .order_by(Startup.created_at.desc())
    )

    out = []
    for startup, score in result.all():
        summary = startup_schema.StartupSummary.model_validate(startup)
        summary.latest_score = score
        out.append(summary)
    return out


@router.get("/{startup_id}", response_model=startup_schema.Startup)
async def read_startup(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    return await get_owned_startup(db, startup_id, current_user)


@router.put("/{startup_id}/sip", response_model=startup_schema.Startup)
async def update_startup_sip(
    *,
    startup_id: uuid.UUID,
    sip_in: startup_schema.SIPUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Merge sections into the Intelligence Profile.

    Sections present in the body replace their stored counterpart; sections
    absent from the body are left untouched. exclude_unset is what makes that
    distinction possible - without it, Pydantic's section defaults would look
    identical to "the user cleared this" and would wipe stored data.
    """
    startup = await get_owned_startup(db, startup_id, current_user)

    provided = sip_in.model_dump(exclude_unset=True, mode="json")
    # Reassign a NEW dict. No MutableDict is configured on the JSONB column, so
    # mutating startup.sip_data in place would not be seen by SQLAlchemy and the
    # update would silently no-op.
    startup.sip_data = {**(startup.sip_data or {}), **provided}

    db.add(startup)
    await db.commit()
    await db.refresh(startup)
    return startup


@router.get("/{startup_id}/reports", response_model=List[ReportOut])
async def list_startup_reports(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List reports for a startup, newest first."""
    await get_owned_startup(db, startup_id, current_user)
    result = await db.execute(
        select(Report)
        .filter(Report.startup_id == startup_id)
        .order_by(Report.created_at.desc())
    )
    return result.scalars().all()


@router.patch("/{startup_id}", response_model=startup_schema.Startup)
async def update_startup(
    *,
    startup_id: uuid.UUID,
    startup_in: startup_schema.StartupUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Edit the basics. Only fields present in the body are touched."""
    startup = await get_owned_startup(db, startup_id, current_user)

    for field, value in startup_in.model_dump(exclude_unset=True).items():
        setattr(startup, field, value)

    db.add(startup)
    await db.commit()
    await db.refresh(startup)
    return startup


@router.delete("/{startup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_startup(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Delete a startup and everything generated from it.

    Children are removed explicitly rather than via ON DELETE CASCADE: the
    foreign keys were created without one, so the database would otherwise
    reject the delete with a constraint violation.
    """
    startup = await get_owned_startup(db, startup_id, current_user)

    await db.execute(delete(InvestorView).where(InvestorView.startup_id == startup.id))
    await db.execute(delete(Report).where(Report.startup_id == startup.id))
    await db.delete(startup)
    await db.commit()


@router.post("/{startup_id}/upload-deck", response_model=DeckUploadResponse)
async def upload_deck(
    startup_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Extract a PDF deck into the Intelligence Profile.

    Runs inline rather than as a background task: the founder is watching the
    upload and needs to know which fields were filled before deciding what to
    type next. A queued job here would mean an empty form and no feedback.

    Only EMPTY fields are filled. Anything the founder already wrote wins over
    anything the parser finds - re-uploading a deck must never silently
    overwrite hand-corrected data.
    """
    startup = await get_owned_startup(db, startup_id, current_user)

    if (file.content_type or "").lower() not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a PDF. Other formats are not supported yet.",
        )

    raw = await file.read()
    if len(raw) > MAX_DECK_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"That file is over {MAX_DECK_BYTES // (1024 * 1024)}MB.",
        )

    try:
        text = extract_pdf_text(raw)
    except DeckParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from None

    try:
        parsed = await ai_service.parse_deck(text, startup.name)
    except Exception:
        logger.exception("deck parse failed for startup %s", startup.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not read that deck. Please try again.",
        ) from None

    merged, filled = apply_parsed_deck(startup.sip_data, parsed)

    # Reassign a NEW dict - no MutableDict on the JSONB column, so an in-place
    # mutation would not be flushed.
    startup.sip_data = merged
    if parsed.one_liner and not startup.one_liner:
        startup.one_liner = parsed.one_liner
        filled.append("One-liner")

    db.add(startup)
    await db.commit()

    return {"status": "completed", "fields_filled": filled, "notes": parsed.notes}
