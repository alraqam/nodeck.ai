import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2),
) -> User:
    """Resolve the bearer token to a User.

    Every failure mode - malformed token, bad signature, expired, missing
    subject, deleted user - returns the same 401. A 403 or 404 here would mean
    the frontend's "401 -> clear token -> /login" path never fires, and a 404
    would leak whether an account exists.
    """
    try:
        payload = security.decode_access_token(token)
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION from None

    email = payload.get("sub")
    if not email:
        raise CREDENTIALS_EXCEPTION

    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user:
        raise CREDENTIALS_EXCEPTION
    return user
