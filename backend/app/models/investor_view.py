import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class InvestorView(Base):
    """A single startup's story retold for one specific investor's thesis.

    Kept in its own table rather than as another Report `type` because the row
    carries inputs of its own (investor_name, investor_thesis) that a report
    has no column for, and because founders list these per investor.
    """

    # Explicit: the Base auto-namer would produce "investorviews", but
    # database_schema.md specifies INVESTOR_VIEWS.
    __tablename__ = "investor_views"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    startup_id = Column(UUID(as_uuid=True), ForeignKey("startups.id"), nullable=False)
    investor_name = Column(String, nullable=False)
    investor_thesis = Column(String, nullable=True)
    # PENDING | COMPLETED | FAILED - mirrors Report so the frontend can poll
    # both with the same logic.
    status = Column(String, nullable=False, default="PENDING")
    content = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    startup = relationship("Startup", backref="investor_views")
