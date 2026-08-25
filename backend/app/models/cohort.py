import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Cohort(Base):
    """A batch of startups an accelerator screens together.

    The accelerator owns both the cohort and the startups inside it - imported
    startups get founder_id set to the accelerator's user id - so every
    existing ownership check, report route and worker path applies unchanged.
    Transferring a profile to the founder who wrote the deck comes later.
    """

    # Explicit: the Base auto-namer appends "s" to the lowercased class name,
    # which produced "investorviews" for InvestorView. "cohorts" is what that
    # would give here too, but stating it removes the question.
    __tablename__ = "cohorts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", backref="cohorts")
