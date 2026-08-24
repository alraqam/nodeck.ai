from typing import Any

from fastapi import APIRouter, Depends

from app.api import deps
from app.models.user import User
from app.schemas.user import User as UserSchema

router = APIRouter()


@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get the currently authenticated user."""
    return current_user
