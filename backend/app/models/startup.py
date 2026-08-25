import uuid
from sqlalchemy import Boolean, Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Startup(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    founder_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    one_liner = Column(String, nullable=True)
    # PRE_SEED | SEED | SERIES_A. Plain string, not a PG enum: adding a
    # value to a PG enum needs a migration, and stages get added.
    stage = Column(String, nullable=True)
    industry = Column(ARRAY(String), nullable=True)
    # Storing the entire Intelligence Profile structure as JSONB for flexibility
    sip_data = Column(JSONB, nullable=True)

    # Nullable: self-serve founders have no cohort, and must stay unaffected
    # by anything the accelerator side does.
    cohort_id = Column(UUID(as_uuid=True), ForeignKey("cohorts.id"), nullable=True, index=True)

    # Public sharing. Deliberately NOT keyed on `slug`: that is derived from
    # the company name and meant to be readable, so it is guessable. This is
    # a 128-bit secret, absent until the founder turns sharing on, and
    # discarded when they turn it off - revoking a link must actually revoke
    # it, not merely hide it.
    share_token = Column(String, unique=True, index=True, nullable=True)
    # Whether the shared page includes the fundability score. Off by default:
    # a founder sharing with an investor is sharing a pitch, not a critique.
    share_score = Column(Boolean, nullable=False, server_default="false")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    founder = relationship("User", backref="startups")
