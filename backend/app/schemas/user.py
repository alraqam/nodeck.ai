import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class UserCreate(UserBase):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # `role` is deliberately NOT accepted from the client. Trusting it would let
    # anyone register as ADMIN. Every registration creates a FOUNDER; elevate
    # out of band if an admin flow is ever needed.


class User(UserBase):
    id: uuid.UUID
    role: str

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
