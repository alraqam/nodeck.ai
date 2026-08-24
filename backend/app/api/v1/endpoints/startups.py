from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.startup import Startup
from app.models.user import User
from app.schemas import startup as startup_schema

router = APIRouter()

@router.post("/", response_model=startup_schema.Startup)
async def create_startup(
    *,
    db: AsyncSession = Depends(deps.get_db),
    startup_in: startup_schema.StartupCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new startup profile.
    """
    result = await db.execute(select(Startup).filter(Startup.slug == startup_in.slug))
    existing_startup = result.scalars().first()
    if existing_startup:
        raise HTTPException(status_code=400, detail="Startup with this slug already exists.")

    startup = Startup(
        name=startup_in.name,
        slug=startup_in.slug,
        one_liner=startup_in.one_liner,
        founder_id=current_user.id,
        sip_data={}  # Initialize empty SIP
    )
    db.add(startup)
    await db.commit()
    await db.refresh(startup)
    return startup

@router.get("/{startup_id}", response_model=startup_schema.Startup)
async def read_startup(
    startup_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get startup details by ID.
    User must be the founder or an admin/investor (Policy TBD). 
    For MVP, allow if founder.
    """
    result = await db.execute(select(Startup).filter(Startup.id == startup_id))
    startup = result.scalars().first()
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    
    # Simple permission check
    if startup.founder_id != current_user.id and current_user.role != "ADMIN":
         raise HTTPException(status_code=400, detail="Not enough permissions")
         
    return startup

@router.put("/{startup_id}/sip", response_model=startup_schema.Startup)
async def update_startup_sip(
    *,
    startup_id: str,
    sip_in: startup_schema.StartupIntelligenceProfile,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update the Startup Intelligence Profile (SIP) data.
    """
    result = await db.execute(select(Startup).filter(Startup.id == startup_id))
    startup = result.scalars().first()
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")

    if startup.founder_id != current_user.id:
         raise HTTPException(status_code=400, detail="Not enough permissions")
    
    # Update SIP data (merge or replace strategy? Replace for simplicity now)
    startup.sip_data = sip_in.model_dump()
    
    db.add(startup)
    await db.commit()
    await db.refresh(startup)
    return startup
