"""What happened to a startup after it was scored.

A score is only worth anything once it can be checked against reality, which is
why the roadmap wants this recorded from the first audit rather than added when
the dataset is needed. One row per startup, upserted.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.startups import get_owned_startup
from app.models.outcome import Outcome
from app.models.user import User
from app.schemas.outcome import OutcomeOut, OutcomeUpsert

router = APIRouter()


@router.get("/{startup_id}/outcome", response_model=OutcomeOut | None)
async def read_outcome(
    startup_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    await get_owned_startup(db, startup_id, current_user)
    result = await db.execute(select(Outcome).filter(Outcome.startup_id == startup_id))
    return result.scalars().first()


@router.put("/{startup_id}/outcome", response_model=OutcomeOut)
async def upsert_outcome(
    startup_id: uuid.UUID,
    outcome_in: OutcomeUpsert,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Record or update the outcome. Upsert, because the answer changes over
    time - RAISING becomes RAISED - and history is not the question being
    asked."""
    await get_owned_startup(db, startup_id, current_user)

    result = await db.execute(select(Outcome).filter(Outcome.startup_id == startup_id))
    outcome = result.scalars().first()
    if outcome is None:
        outcome = Outcome(startup_id=startup_id)

    for field, value in outcome_in.model_dump(exclude_unset=True).items():
        setattr(outcome, field, value)

    db.add(outcome)
    await db.commit()
    await db.refresh(outcome)
    return outcome
