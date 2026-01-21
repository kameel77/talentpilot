"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

from models import ReviewStatus


# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class GallupDomain(str, Enum):
    EXECUTING = "executing"
    INFLUENCING = "influencing"
    RELATIONSHIP_BUILDING = "relationship_building"
    STRATEGIC_THINKING = "strategic_thinking"


# Organization Schemas
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class OrganizationResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    superpowers: Optional[str] = None
    motivators: Optional[str] = None
    blockers: Optional[str] = None
    feedback_style: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    job_title: Optional[str] = None
    role: UserRole
    is_active: bool
    is_ghost: bool
    avatar_url: Optional[str] = None
    organization_id: int
    created_at: datetime
    
    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    """Extended user response with User Manual fields."""
    superpowers: Optional[str] = None
    motivators: Optional[str] = None
    blockers: Optional[str] = None
    feedback_style: Optional[str] = None


# Invitation Schemas
class GhostInviteTalent(BaseModel):
    talent_id: int
    rank: int = Field(..., ge=1, le=5)


class GhostInviteCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    job_title: Optional[str] = None
    team_id: int
    talents: Optional[List[GhostInviteTalent]] = None


class GhostInviteResponse(BaseModel):
    invitation_id: int
    user_id: int
    invite_token: str
    expires_at: datetime
    status: str


# Team Schemas
class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    manager_id: Optional[int] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    organization_id: int
    manager_id: Optional[int] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


# Talent Schemas
class TalentTranslationResponse(BaseModel):
    language: str
    name: str
    description: Optional[str] = None
    short_description: Optional[str] = None

    model_config = {"from_attributes": True}


class TalentResponse(BaseModel):
    id: int
    code: str
    domain: GallupDomain
    translation: TalentTranslationResponse

    model_config = {"from_attributes": True}


class UserTalentCreate(BaseModel):
    talent_id: int
    rank: int = Field(..., ge=1, le=34)


class UserTalentResponse(BaseModel):
    id: int
    talent_id: int
    rank: int
    talent: TalentResponse
    
    model_config = {"from_attributes": True}


class DomainDistribution(BaseModel):
    """Distribution of user's talents across 4 Gallup domains."""
    executing: int = 0
    influencing: int = 0
    relationship_building: int = 0
    strategic_thinking: int = 0


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
    organization_name: str = Field(..., min_length=1, max_length=255)


# AI Tip Schemas
class AITipResponse(BaseModel):
    id: int
    tip_content: str
    talent_focus: Optional[str] = None
    context: Optional[str] = None
    helpful: Optional[bool] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class AITipFeedback(BaseModel):
    helpful: bool


class GallupPdfParseResponse(BaseModel):
    page_index: Optional[int] = None
    rankings: dict[str, int]  # Internal code -> rank
    translated_rankings: dict[str, int]  # Translated name -> rank
    language: str


class AssistantQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    target_user_id: Optional[int] = None
    language: str = Field(default="pl", min_length=2, max_length=10)


class AssistantQueryResponse(BaseModel):
    query_id: int
    answer_id: int
    answer_text: str
    model_name: str

    model_config = {
        "from_attributes": True,
        "protected_namespaces": (),
    }


class KnowledgeItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=120)
    tags: List[str] = Field(default_factory=list)
    section: str = Field(..., min_length=1, max_length=40)
    content: str = Field(..., min_length=1)
    language: str = Field(default="pl", min_length=2, max_length=10)
    metadata_json: dict = Field(default_factory=dict)


class KnowledgeItemUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tags: Optional[List[str]] = None
    section: Optional[str] = Field(default=None, min_length=1, max_length=40)
    content: Optional[str] = Field(default=None, min_length=1)
    language: Optional[str] = Field(default=None, min_length=2, max_length=10)
    is_active: Optional[bool] = None
    metadata_json: Optional[dict] = None


class KnowledgeItemResponse(BaseModel):
    id: int
    title: str
    category: str
    tags: List[str]
    section: str
    content: str
    language: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminSettingUpdate(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1, max_length=500)


class AdminSettingsResponse(BaseModel):
    settings: dict[str, str]


# ReviewStatus imported from models.py


class QueryReviewResponse(BaseModel):
    query_id: int
    question: str
    language: str
    created_at: datetime
    answer_id: int
    answer_text: str
    model_name: str
    status: ReviewStatus
    edited_text: Optional[str] = None

    model_config = {
        "protected_namespaces": (),
    }


class ReviewUpdate(BaseModel):
    status: ReviewStatus
    edited_text: Optional[str] = None


# QA v1 Schemas
class QAQueryRequest(BaseModel):
    context: str = Field(..., description="'self' or 'team'")
    question: str = Field(..., min_length=1, max_length=2000)
    target_user_id: Optional[int] = None
    language: str = Field(default="pl", min_length=2, max_length=10)


class QAAction(BaseModel):
    action: str


class QAAnswer(BaseModel):
    talent: str
    competency: str
    actions: List[str]
    fallback: bool = False


class QAQueryResponse(BaseModel):
    query_id: int
    answer_id: int
    answer: QAAnswer
    source: str = "ai+talent-mapping"


class QAFeedbackRequest(BaseModel):
    query_id: int
    answer_id: int
    rating: Optional[int] = Field(None, ge=1, le=5)
    is_effective: Optional[bool] = None
    comment: Optional[str] = None


class QAHistoryItem(BaseModel):
    query_id: int
    question: str
    context: str
    answer: QAAnswer
    created_at: datetime

    model_config = {"from_attributes": True}
