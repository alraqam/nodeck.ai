import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime
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
    # Storing the entire Intelligence Profile structure as JSONB for flexibility
    sip_data = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    founder = relationship("User", backref="startups")
