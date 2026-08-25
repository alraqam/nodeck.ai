import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CohortCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)


class CohortUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=2000)


class CohortOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    # Filled by the list/detail endpoints so a cohort card can show progress
    # without the client fetching every startup.
    startup_count: int = 0
    scored_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class DeckImportResult(BaseModel):
    """What happened to one uploaded file."""

    filename: str
    # A file that could not be read still gets reported by name, so an
    # accelerator can see which of thirty decks needs attention rather than
    # discovering a silent gap in the ranking later.
    ok: bool
    startup_id: Optional[uuid.UUID] = None
    startup_name: Optional[str] = None
    report_id: Optional[uuid.UUID] = None
    fields_filled: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class DeckImportResponse(BaseModel):
    cohort_id: uuid.UUID
    imported: int
    failed: int
    results: List[DeckImportResult]


class CohortRow(BaseModel):
    """One startup's line in the cohort ranking."""

    startup_id: uuid.UUID
    name: str
    one_liner: Optional[str] = None
    stage: Optional[str] = None
    industry: List[str] = Field(default_factory=list)
    # PENDING while the worker has not finished; FAILED carries `error`.
    status: str
    total_score: Optional[int] = None
    breakdown: Optional[Dict[str, Any]] = None
    confidence: Optional[str] = None
    top_fixes: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    outcome_status: Optional[str] = None
    raised_amount: Optional[float] = None


class CohortReport(BaseModel):
    cohort: CohortOut
    rows: List[CohortRow]
    # Counts by band, so the accelerator sees the shape of the cohort without
    # reading every row.
    distribution: Dict[str, int]
