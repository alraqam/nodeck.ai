import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class ReportType(str, enum.Enum):
    FUNDABILITY_SCORE = "FUNDABILITY_SCORE"
    INVESTMENT_MEMO = "INVESTMENT_MEMO"
    PITCH_DECK = "PITCH_DECK"

class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class Report(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    startup_id = Column(UUID(as_uuid=True), ForeignKey("startups.id"), nullable=False)
    type = Column(String, nullable=False) # Enum
    status = Column(String, default=ReportStatus.PENDING, nullable=False)
    content = Column(JSONB, nullable=True) # The actual result
    # Denormalised {total_score, breakdown} for FUNDABILITY_SCORE reports.
    # Lets the history list render scores without shipping every full report.
    score_summary = Column(JSONB, nullable=True)

    # Job-queue bookkeeping. The report row IS the job record, so a claim
    # survives a process restart the way an in-memory task never could.
    # locked_at is the lease: set when a worker claims the row, cleared on
    # a terminal state, and treated as expired once it is old enough that
    # the worker holding it must be gone.
    locked_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, nullable=False, server_default="0")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    startup = relationship("Startup", backref="reports")
