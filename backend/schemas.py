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
    COACH = "coach"
    USER = "user"


class GallupDomain(str, Enum):
    EXECUTING = "executing"
    INFLUENCING = "influencing"
    RELATIONSHIP_BUILDING = "relationship_building"
    STRATEGIC_THINKING = "strategic_thinking"


# Organization Schemas
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    street: Optional[str] = Field(default=None, max_length=255)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=120)
    tax_id: Optional[str] = Field(default=None, max_length=32)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)
    street: Optional[str] = Field(default=None, max_length=255)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=120)
    tax_id: Optional[str] = Field(default=None, max_length=32)
    language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')


class OrganizationTeamSimple(BaseModel):
    id: int
    name: str
    
    model_config = {"from_attributes": True}


class OrganizationResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    tax_id: Optional[str] = None
    language: str = "pl"
    created_at: datetime
    teams: Optional[List[OrganizationTeamSimple]] = None

    model_config = {"from_attributes": True}


# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    job_title: Optional[str] = Field(default=None, max_length=255)
    job_title_en: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    superpowers: Optional[str] = None
    motivators: Optional[str] = None
    blockers: Optional[str] = None
    feedback_style: Optional[str] = None
    superpowers_en: Optional[str] = None
    motivators_en: Optional[str] = None
    blockers_en: Optional[str] = None
    feedback_style_en: Optional[str] = None
    public_profile_settings: Optional[dict] = None
    public_slug: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=64,
        pattern=r'^[a-z0-9][a-z0-9\-]*[a-z0-9]$',
        description="Custom vanity slug for /aboutme/{slug}. Lowercase letters, numbers and hyphens only.",
    )
    language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=8, max_length=72)
    new_password: str = Field(..., min_length=8, max_length=72)


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    job_title: Optional[str] = None
    job_title_en: Optional[str] = None
    role: UserRole
    is_active: bool
    is_ghost: bool
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    organization_id: int
    created_at: datetime
    public_token: Optional[str] = None
    public_slug: Optional[str] = None
    language: str = "pl"

    # Relationships for admins
    organizations_access: Optional[List[int]] = None

    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    """Extended user response with User Manual fields."""
    superpowers: Optional[str] = None
    motivators: Optional[str] = None
    blockers: Optional[str] = None
    feedback_style: Optional[str] = None
    superpowers_en: Optional[str] = None
    motivators_en: Optional[str] = None
    blockers_en: Optional[str] = None
    feedback_style_en: Optional[str] = None
    public_profile_settings: Optional[dict] = None


# Admin Management Schemas
class AdminRoleUpdate(BaseModel):
    role: UserRole

class AdminOrgAccessToggle(BaseModel):
    organization_id: int
    has_access: bool


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = UserRole.USER
    organization_id: Optional[int] = None


# Invitation Schemas
class GhostInviteTalent(BaseModel):
    talent_id: int
    rank: int = Field(..., ge=1, le=34)


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


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=72)


# Team Schemas
class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    manager_id: Optional[int] = None
    organization_id: Optional[int] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    organization_id: int
    organization_name: Optional[str] = None
    manager_id: Optional[int] = None
    members_count: Optional[int] = None
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


class RegisterCoachRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=72)



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
    first_name: Optional[str] = None
    last_name: Optional[str] = None


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
    metadata_json: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class KnowledgeItemBulkCreate(BaseModel):
    items: List[KnowledgeItemCreate]


class KnowledgeItemBulkResponse(BaseModel):
    created: int
    errors: List[str] = []
    items: List[KnowledgeItemResponse]


class AdminSettingUpdate(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., max_length=10000)


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
    answer_raw: str = ""
    render_mode: str = "structured"
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
    answer_raw: str = ""
    render_mode: str = "structured"
    created_at: datetime

    model_config = {"from_attributes": True}


# External API Schemas
class ExternalPersonInfo(BaseModel):
    first_name: Optional[str] = Field(default=None, description="First name extracted from the Gallup report header")
    last_name: Optional[str] = Field(default=None, description="Last name extracted from the Gallup report header")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"first_name": "Kamil", "last_name": "Tonkowicz"},
                {"first_name": "Anna Maria", "last_name": "Kowalska"},
            ]
        }
    }


class ExternalTalentName(BaseModel):
    pl: Optional[str] = Field(default=None, description="Talent name in Polish (present when language=pl or pl+en)")
    en: Optional[str] = Field(default=None, description="Talent name in English (present when language=en or pl+en)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"pl": "Osiąganie", "en": "Achiever"},
                {"pl": "Osiąganie", "en": None},
                {"pl": None, "en": "Achiever"},
            ]
        }
    }


class ExternalDomain(BaseModel):
    number: int = Field(description="Domain index: Executing=1, Influencing=2, Relationship Building=3, Strategic Thinking=4")
    pl: Optional[str] = Field(default=None, description="Domain name in Polish (present when language=pl or pl+en)")
    en: Optional[str] = Field(default=None, description="Domain name in English (present when language=en or pl+en)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"number": 1, "pl": "Realizowanie", "en": "Executing"},
                {"number": 2, "pl": "Wywieranie wpływu", "en": None},
                {"number": 3, "pl": None, "en": "Relationship Building"},
            ]
        }
    }


class ExternalTalent(BaseModel):
    rank: int = Field(description="Talent position in the Gallup report (1–34). Lower = stronger talent.")
    talent: str = Field(description="Internal talent code (e.g. 'achiever', 'learner')")
    domain: ExternalDomain
    name: ExternalTalentName

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "rank": 1,
                    "talent": "achiever",
                    "domain": {"number": 1, "pl": "Realizowanie", "en": "Executing"},
                    "name": {"pl": "Osiąganie", "en": "Achiever"},
                }
            ]
        }
    }


class ExternalGallupResponse(BaseModel):
    language: str = Field(description="Language filter used in this response: pl, en, or pl+en")
    person: Optional[ExternalPersonInfo] = Field(default=None, description="Person info (first/last name) extracted from the PDF header")
    talents: List[ExternalTalent] = Field(description="Talents parsed from the PDF, sorted by rank ascending")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "language": "pl+en",
                    "talents": [
                        {
                            "rank": 1,
                            "talent": "achiever",
                            "domain": {"number": 1, "pl": "Realizowanie", "en": "Executing"},
                            "name": {"pl": "Osiąganie", "en": "Achiever"},
                        },
                        {
                            "rank": 2,
                            "talent": "learner",
                            "domain": {"number": 4, "pl": "Myślenie strategiczne", "en": "Strategic Thinking"},
                            "name": {"pl": "Uczenie się", "en": "Learner"},
                        },
                    ],
                },
                {
                    "language": "pl",
                    "talents": [
                        {
                            "rank": 1,
                            "talent": "achiever",
                            "domain": {"number": 1, "pl": "Realizowanie", "en": None},
                            "name": {"pl": "Osiąganie", "en": None},
                        }
                    ],
                },
                {
                    "language": "en",
                    "talents": [
                        {
                            "rank": 1,
                            "talent": "achiever",
                            "domain": {"number": 1, "pl": None, "en": "Executing"},
                            "name": {"pl": None, "en": "Achiever"},
                        }
                    ],
                },
            ],
        }
    }


# -------- Compare Schemas --------

class TalentCompareItem(BaseModel):
    """A single talent in comparison context."""
    code: str
    name: str
    domain: str
    rank: int


class SharedTalent(BaseModel):
    """A talent shared by both users (bridge)."""
    code: str
    name: str
    domain: str
    rank_a: int
    rank_b: int


class DomainBalance(BaseModel):
    """Domain talent count for both users."""
    domain: str
    domain_label: str
    count_a: int
    count_b: int


class CompareResponse(BaseModel):
    """Full comparison result between two users."""
    user_a: UserResponse
    user_b: UserResponse
    shared_talents: List[SharedTalent]
    unique_a: List[TalentCompareItem]
    unique_b: List[TalentCompareItem]
    domain_balance: List[DomainBalance]
    synergy_score: int
    collaboration_tips: List[str]


# -------- Tips Schemas --------

class DailyTipResponse(BaseModel):
    """AI-generated daily tip."""
    tip_id: Optional[int] = None
    content: str
    talent_focus: str
    context: str


class SynergyTipResponse(BaseModel):
    """Synergy tip for team interaction."""
    tip_id: Optional[int] = None
    content: str
    target_user_name: Optional[str] = None
    shared_talents: List[SharedTalent] = []
    synergy_score: int = 0
    collaboration_tips: List[str] = []
    domain_balance: List[DomainBalance] = []


class TipFeedbackRequest(BaseModel):
    """Feedback on a tip."""
    tip_id: int
    helpful: bool


# -------- Public Profile (Wizytówka) --------

class PublicTalentItem(BaseModel):
    rank: int
    code: str
    name_pl: str
    name_en: Optional[str] = None
    domain: str

    model_config = {"from_attributes": True}


class PublicProfileResponse(BaseModel):
    """Public business card — only fields permitted by owner's privacy settings."""
    full_name: str
    job_title: Optional[str] = None
    job_title_en: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    talents: Optional[List[PublicTalentItem]] = None
    superpowers: Optional[str] = None
    motivators: Optional[str] = None
    blockers: Optional[str] = None
    feedback_style: Optional[str] = None
    superpowers_en: Optional[str] = None
    motivators_en: Optional[str] = None
    blockers_en: Optional[str] = None
    feedback_style_en: Optional[str] = None


# -------- External Provision --------

class ExternalProvisionOrgTeamRequest(BaseModel):
    org_name: str = Field(..., min_length=1, max_length=255)
    org_id: Optional[int] = None
    team_name: str = Field(..., min_length=1, max_length=255)
    team_id: Optional[int] = None


class ExternalProvisionOrgTeamResponse(BaseModel):
    org_id: int
    team_id: int
    org_created: bool
    team_created: bool


class ExternalProvisionUserTalent(BaseModel):
    talent_code: str = Field(..., description="Talent code, e.g. 'achiever'")
    rank: int = Field(..., ge=1, le=34)


class ExternalProvisionUser(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    talents: Optional[List[ExternalProvisionUserTalent]] = None


class ExternalProvisionUsersRequest(BaseModel):
    org_id: int
    team_id: int
    users: List[ExternalProvisionUser] = Field(..., min_length=1)


class ExternalProvisionUserResult(BaseModel):
    email: str
    full_name: str
    status: str  # "created" | "existing" | "error"
    user_id: Optional[int] = None
    error: Optional[str] = None


class ExternalProvisionUsersResponse(BaseModel):
    total: int
    created: int
    existing: int
    errors: int
    results: List[ExternalProvisionUserResult]


# -------- Public Team Presentation --------

class PresentationTalentResult(BaseModel):
    id: str
    rank: int
    talent: str
    domain: str


class PresentationMember(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    is_leader: bool = False
    is_ghost: bool = False
    invited_at: Optional[datetime] = None
    invitation_status: str = "active"
    results: List[PresentationTalentResult]


class PresentationOrg(BaseModel):
    id: str
    name: str


class PublicTeamPresentationResponse(BaseModel):
    id: str
    name: str
    organization: PresentationOrg
    members: List[PresentationMember]


# ─────────────────────────────────────────────────────────────────────
# Dashboard overview — replaces N+1 fetch pattern on /dashboard
# ─────────────────────────────────────────────────────────────────────

class TeamDomainCounts(BaseModel):
    """Count of talents per Gallup domain across visible team members."""
    executing: int = 0
    influencing: int = 0
    relationship_building: int = 0
    strategic_thinking: int = 0


class DashboardMember(BaseModel):
    """Compact user info for dashboard member cards."""
    id: int
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class DashboardOverview(BaseModel):
    """Single-call aggregate for the dashboard landing page."""
    total_users: int
    users_with_talents: int
    team_domains: TeamDomainCounts
    members: List[DashboardMember]
