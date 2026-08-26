from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class UserActivity(Base):
    """
    Lightweight event log for user activities in CodeLens AI.
    Captures fine-grained events that existing models don't fully cover
    (e.g. visualization_started/completed, editor_open, practice events).

    Execution events are also mirrored here so the dashboard can query
    a single table instead of joining multiple tables.
    """
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Event classification
    # Values: code_execution | visualization_started | visualization_completed |
    #         ai_tutor | program_saved | practice | editor_open
    activity_type = Column(String(50), nullable=False, index=True)

    # Human-readable title, e.g. "Ran Fibonacci Algorithm"
    title = Column(String(500), nullable=False)

    # Optional richer description
    description = Column(Text, nullable=True)

    # Program / context fields
    program_name = Column(String(500), nullable=True, index=True)
    language = Column(String(100), nullable=True, index=True)
    topic = Column(String(255), nullable=True)

    # Lifecycle
    status = Column(String(50), nullable=True)  # success | error | completed | in_progress

    # Timing
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)

    # Extra structured data (steps count, error message, etc.)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="activities")
