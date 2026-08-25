import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
ALGORITHM = settings.ALGORITHM


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError on any invalid/expired/tampered token."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# A real Argon2 hash of a value nobody holds, used to spend the same time
# verifying a password for an account that does not exist as for one that
# does. Built once at import: doing it lazily would leave the very first
# miss fast, which is all an attacker needs.
_DUMMY_HASH = pwd_context.hash(secrets.token_urlsafe(32))


def waste_password_time() -> None:
    """Burn a verification against a throwaway hash.

    Without this, login returns in ~50ms for an unknown address and ~300ms
    for a known one, because Argon2 only runs when a user was found. That
    gap is trivially measurable and turns a uniform error message into a
    reliable "does this account exist" oracle.
    """
    pwd_context.verify("not-the-password", _DUMMY_HASH)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
