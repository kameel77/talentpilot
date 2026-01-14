"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


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
    role: UserRole
    is_active: bool
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
class TalentResponse(BaseModel):
    id: int
    name: str
    domain: GallupDomain
    description: str
    short_description: Optional[str] = None
    order_number: Optional[int] = None
    
    model_config = {"from_attributes": True}


class TalentOrderUpdate(BaseModel):
    name: str
    order_number: Optional[int] = Field(default=None, ge=1, le=34)


class UserTalentCreate(BaseModel):
    talent_id: int
    rank: int = Field(..., ge=1, le=5)


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
