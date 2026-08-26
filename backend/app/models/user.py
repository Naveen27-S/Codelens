from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # username is auto-generated from email prefix — kept for backward compatibility
    # with existing code_executions / history FKs that may reference it
    username = Column(String(100), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    profile_image = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    executions = relationship("CodeExecution", back_populates="user")
    history = relationship("CodeHistory", back_populates="user")
    conversations = relationship("AiConversation", back_populates="user")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
