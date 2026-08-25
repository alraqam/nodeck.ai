import enum
import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class OutcomeStatus(str, enum.Enum):
    UNKNOWN = "UNKNOWN"
    RAISING = "RAISING"
    RAISED = "RAISED"
    FAILED = "FAILED"
    INACTIVE = "INACTIVE"


class Outcome(Base):
    """What actually happened to a scored startup.

    The roadmap calls this the seed of the moat and says it should be recorded
    from the first audit: a score is only trustworthy once it can be checked
    against whether the company went on to raise. One row per startup, updated
    over time rather than appended, because the question is the current state.
    """

    __tablename__ = "outcomes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Unique: a startup has one current outcome, so an upsert cannot silently
    # create a second conflicting record.
    startup_id = Column(
        UUID(as_uuid=True), ForeignKey("startups.id"), nullable=False, unique=True, index=True
    )
    status = Column(String, nullable=False, server_default=OutcomeStatus.UNKNOWN.value)
    # USD. Null when unknown or not raised - 0 would claim they raised nothing.
    raised_amount = Column(Float, nullable=True)
    raised_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    startup = relationship("Startup", backref="outcome")
