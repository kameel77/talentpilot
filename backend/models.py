"""SQLAlchemy models for the TalentPilot application."""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table, Text, JSON, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


# Enum for user roles
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


# Enum for Gallup domains
class GallupDomain(str, enum.Enum):
    EXECUTING = "executing"
    INFLUENCING = "influencing"
    RELATIONSHIP_BUILDING = "relationship_building"
    STRATEGIC_THINKING = "strategic_thinking"


# Association table for user-team many-to-many relationship
user_teams = Table(
    'user_teams',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE')),
    Column('team_id', Integer, ForeignKey('teams.id', ondelete='CASCADE'))
)


class Organization(Base):
    """Organization model for multi-tenancy."""
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    """User model with role-based access control."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # User Manual fields (editable by user)
    superpowers = Column(Text, nullable=True)  # "Moje Supermoce"
    motivators = Column(Text, nullable=True)   # "Wyzwalacze"
    blockers = Column(Text, nullable=True)     # "Blokady"
    feedback_style = Column(Text, nullable=True)  # "Jak mi dawać feedback"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    teams = relationship("Team", secondary=user_teams, back_populates="members")
    user_talents = relationship("UserTalent", back_populates="user", cascade="all, delete-orphan")
    managed_teams = relationship("Team", back_populates="manager", foreign_keys="Team.manager_id")


class Team(Base):
    """Team model for grouping users."""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    # Manager of the team
    manager_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="teams")
    manager = relationship("User", back_populates="managed_teams", foreign_keys=[manager_id])
    members = relationship("User", secondary=user_teams, back_populates="teams")


class Talent(Base):
    """Talent model representing the 34 CliftonStrengths talents."""
    __tablename__ = "talents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "Achiever"
    domain = Column(SQLEnum(GallupDomain), nullable=False)
    description = Column(Text, nullable=False)
    short_description = Column(String(500), nullable=True)
    
    # Relationships
    user_talents = relationship("UserTalent", back_populates="talent")


class UserTalent(Base):
    """Association model for User-Talent with ranking (Top 5)."""
    __tablename__ = "user_talents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    talent_id = Column(Integer, ForeignKey('talents.id', ondelete='CASCADE'), nullable=False)
    rank = Column(Integer, nullable=False)  # 1-5 for top 5 talents
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="user_talents")
    talent = relationship("Talent", back_populates="user_talents")


class KnowledgeBase(Base):
    """Knowledge base for RAG with pgvector embeddings."""
    __tablename__ = "knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    
    # pgvector embedding (will be added after pgvector migration)
    # embedding = Column(Vector(384))  # For multilingual-e5-small or text-embedding-3-small
    
    # Metadata for filtering
    metadata_json = Column(JSON, nullable=False)  # e.g., {"talent_id": 1, "context": "motivation"}
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AITip(Base):
    """AI-generated tips with user feedback."""
    __tablename__ = "ai_tips"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    tip_content = Column(Text, nullable=False)
    talent_focus = Column(String(100), nullable=True)  # Which talent the tip focuses on
    context = Column(String(100), nullable=True)  # e.g., "motivation", "feedback", "conflict"
    
    # User feedback
    helpful = Column(Boolean, nullable=True)  # True/False/NULL (not rated yet)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
