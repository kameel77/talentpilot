"""SQLAlchemy models for the TalentPilot application."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Table,
    Text,
    JSON,
    DateTime,
    Enum as SQLEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from database import Base
import enum


# Enum for user roles
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class InvitationStatus(str, enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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
    address = Column(String(500), nullable=True)
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
    job_title = Column(String(255), nullable=True)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    is_ghost = Column(Boolean, default=False)
    avatar_url = Column(String(500), nullable=True)
    
    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    
    phone = Column(String(50), nullable=True)
    linkedin_url = Column(String(500), nullable=True)

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
    invitations = relationship(
        "TeamInvitation",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="TeamInvitation.user_id",
    )


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
    invitations = relationship("TeamInvitation", back_populates="team", cascade="all, delete-orphan")


INVITATION_STATUS_ENUM = SQLEnum(
    InvitationStatus,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    name="invitationstatus",
)


class TeamInvitation(Base):
    """Invitation for a user to join a team."""
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)
    status = Column(INVITATION_STATUS_ENUM, nullable=False, default=InvitationStatus.ACTIVE)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="invitations", foreign_keys=[user_id])
    team = relationship("Team", back_populates="invitations")
    created_by_user = relationship("User", foreign_keys=[created_by])


class PasswordResetToken(Base):
    """Token for password reset functionality."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class Talent(Base):
    """Talent model representing the 34 CliftonStrengths talents."""
    __tablename__ = "talents"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False)  # e.g., "achiever"
    domain = Column(SQLEnum(GallupDomain), nullable=False)
    
    # Relationships
    user_talents = relationship("UserTalent", back_populates="talent")
    translations = relationship(
        "TalentTranslation",
        back_populates="talent",
        cascade="all, delete-orphan",
    )


class TalentTranslation(Base):
    """Talent translations for multi-language support."""
    __tablename__ = "talent_translations"
    __table_args__ = (
        UniqueConstraint("talent_id", "language", name="uq_talent_translation_language"),
    )

    id = Column(Integer, primary_key=True, index=True)
    talent_id = Column(Integer, ForeignKey('talents.id', ondelete='CASCADE'), nullable=False)
    language = Column(String(10), nullable=False)  # e.g., "en", "pl"
    name = Column(String(100), nullable=False)
    short_description = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    talent = relationship("Talent", back_populates="translations")


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


# NOTE: KnowledgeBase model removed - replaced by KnowledgeItem with pgvector embeddings


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


class AppSetting(Base):
    """Key-value settings for superadmin configuration."""
    __tablename__ = "app_settings"
    __table_args__ = (
        UniqueConstraint("key", name="uq_app_settings_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False)
    value = Column(String(500), nullable=False)
    updated_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_by_user = relationship("User", foreign_keys=[updated_by])


class KnowledgeItem(Base):
    """Curated knowledge items for RAG with embeddings."""
    __tablename__ = "knowledge_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, default="Wpis bez tytułu")
    category = Column(String(120), nullable=False, default="Ogólne")
    tags = Column(JSON, nullable=False, default=list)
    section = Column(String(40), nullable=False, default="merytoryka")
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=False)
    language = Column(String(10), nullable=False, default="pl")
    is_active = Column(Boolean, default=True)

    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    source_query_id = Column(Integer, ForeignKey('user_queries.id', ondelete='SET NULL'), nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_by_user = relationship("User", foreign_keys=[created_by])


class UserQuery(Base):
    """User queries stored for learning and analytics."""
    __tablename__ = "user_queries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    target_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    question = Column(Text, nullable=False)
    question_hash = Column(String(64), nullable=False, index=True)
    embedding = Column(Vector(1536), nullable=False)
    language = Column(String(10), nullable=False, default="pl")
    is_unique = Column(Boolean, default=True)
    matched_query_id = Column(Integer, ForeignKey('user_queries.id', ondelete='SET NULL'), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    matched_query = relationship("UserQuery", remote_side=[id])


class GeneratedAnswer(Base):
    """Answers generated by LLM for a given query."""
    __tablename__ = "generated_answers"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey('user_queries.id', ondelete='CASCADE'), nullable=False)
    answer_text = Column(Text, nullable=False)
    model_name = Column(String(200), nullable=False)
    sources = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    query = relationship("UserQuery")


REVIEW_STATUS_ENUM = SQLEnum(
    ReviewStatus,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    name="reviewstatus",
)


class AnswerReview(Base):
    """Review entries for generated answers."""
    __tablename__ = "answer_reviews"
    __table_args__ = (
        UniqueConstraint("generated_answer_id", name="uq_answer_reviews_generated_answer"),
    )

    id = Column(Integer, primary_key=True, index=True)
    generated_answer_id = Column(Integer, ForeignKey('generated_answers.id', ondelete='CASCADE'), nullable=False)
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    status = Column(REVIEW_STATUS_ENUM, nullable=False, default=ReviewStatus.PENDING)
    edited_text = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    generated_answer = relationship("GeneratedAnswer")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class UserFeedback(Base) :
    """User feedback for generated answers (1-5 scale)."""
    __tablename__ = "user_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey('user_queries.id', ondelete='CASCADE'), nullable=False)
    answer_id = Column(Integer, ForeignKey('generated_answers.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    rating = Column(Integer, nullable=True)  # 1-5
    is_effective = Column(Boolean, nullable=True)  # Tak/Nie
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    query = relationship("UserQuery")
    answer = relationship("GeneratedAnswer")
    user = relationship("User")


class ApiKey(Base):
    """API keys for external applications."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)  # e.g. "External App 1"
    organization_id = Column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    organization = relationship("Organization")
