import re
import uuid
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.report import Report
from app.models.startup import Startup
from app.models.user import User
from app.schemas import startup as startup_schema
from app.schemas.report import ReportOut

router = APIRouter()


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
    """List the current user's startups, newest first."""
    result = await db.execute(
        select(Startup)
        .filter(Startup.founder_id == current_user.id)
        .order_by(Startup.created_at.desc())
    )
    return result.scalars().all()


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
