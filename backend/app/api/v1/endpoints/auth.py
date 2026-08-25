from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.ratelimit import SlidingWindowLimiter, client_key
from app.models.user import User, UserRole
from app.schemas.user import Token, User as UserSchema, UserCreate

router = APIRouter()

# Auth is unauthenticated by definition, so throttling is the only thing
# standing between a password and an offline-speed guessing loop.
#
# Two limiters on login, because they stop different attacks: per-address
# catches one machine working through a wordlist, per-account catches a
# distributed attempt spread across many addresses at one inbox. Either alone
# leaves the other wide open.
#
# The per-address budget is deliberately the looser of the two. Offices and
# mobile carriers put many people behind one address, so a tight IP limit
# locks out bystanders while barely inconveniencing an attacker who can
# rotate addresses. The per-account limit is the one that actually protects
# a password, and it costs an innocent user nothing: a correct login clears
# it.
_login_by_ip = SlidingWindowLimiter(limit=30, window_seconds=300)
_login_by_account = SlidingWindowLimiter(limit=8, window_seconds=900)
_register_by_ip = SlidingWindowLimiter(limit=5, window_seconds=3600)

TOO_MANY = "Too many attempts. Please wait and try again."


def _reject(limiter: SlidingWindowLimiter, key: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=TOO_MANY,
        headers={"Retry-After": str(limiter.retry_after(key))},
    )


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """Create a new founder account."""
    ip = client_key(request, settings.TRUST_PROXY_HEADERS)
    if not _register_by_ip.allow(ip):
        _reject(_register_by_ip, ip)

    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.FOUNDER.value,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """OAuth2 compatible token login. `username` is the email address."""
    ip = client_key(request, settings.TRUST_PROXY_HEADERS)
    account = form_data.username.strip().lower()

    if not _login_by_ip.allow(ip):
        _reject(_login_by_ip, ip)
    if not _login_by_account.allow(account):
        _reject(_login_by_account, account)

    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()

    if not user:
        # Spend the same time as a real verification. Returning early here is
        # what made an identical error message still leak whether the account
        # exists - see security.waste_password_time.
        security.waste_password_time()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    # A correct password clears the account's budget, so someone who simply
    # mistyped a few times is not locked out of their own account.
    _login_by_account.reset(account)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.email, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }
