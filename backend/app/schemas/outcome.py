import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

OutcomeStatusLiteral = Literal["UNKNOWN", "RAISING", "RAISED", "FAILED", "INACTIVE"]


class OutcomeUpsert(BaseModel):
    status: OutcomeStatusLiteral
    # Null rather than 0 when unknown: 0 would assert they raised nothing.
    raised_amount: Optional[float] = Field(default=None, ge=0)
    raised_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class OutcomeOut(BaseModel):
    id: uuid.UUID
    startup_id: uuid.UUID
    status: str
    raised_amount: Optional[float] = None
    raised_at: Optional[datetime] = None
    notes: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
