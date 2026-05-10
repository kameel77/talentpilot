"""Talents router for listing talents and assigning them to users."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Talent, TalentTranslation, UserTalent, GallupDomain
from schemas import (
    TalentResponse,
    TalentTranslationResponse,
    UserTalentCreate,
    UserTalentResponse,
    DomainDistribution
)
from auth import get_current_user, require_role, check_org_access

router = APIRouter()


def _fetch_translation(
    db: Session,
    talent_id: int,
    language: str,
    fallback_language: str = "en",
) -> TalentTranslation:
    translation = (
        db.query(TalentTranslation)
        .filter(
            TalentTranslation.talent_id == talent_id,
            TalentTranslation.language == language,
        )
        .first()
    )
    if translation or language == fallback_language:
        return translation
    return (
        db.query(TalentTranslation)
        .filter(
            TalentTranslation.talent_id == talent_id,
            TalentTranslation.language == fallback_language,
        )
        .first()
    )


def _build_talent_response(
    talent: Talent,
    translation: TalentTranslation,
) -> TalentResponse:
    return TalentResponse(
        id=talent.id,
        code=talent.code,
        domain=talent.domain,
        translation=TalentTranslationResponse.from_orm(translation),
    )


@router.get("/talents", response_model=List[TalentResponse])
def list_talents(
    language: str = Query("en", min_length=2, max_length=10),
    db: Session = Depends(get_db),
):
    """
    List all 34 CliftonStrengths talents.
    
    - Public endpoint (no auth required for reading talents)
    - Ordered by domain and name
    """
    talents = db.query(Talent).order_by(Talent.domain, Talent.code).all()
    responses: List[TalentResponse] = []
    for talent in talents:
        translation = _fetch_translation(db, talent.id, language)
        if not translation:
            continue
        responses.append(_build_talent_response(talent, translation))
    return responses


@router.get("/domains", response_model=List[str])
def list_domains():
    """
    List 4 Gallup domains.
    
    - Returns domain names
    """
    return [domain.value for domain in GallupDomain]


@router.post("/users/{user_id}/talents", response_model=List[UserTalentResponse], status_code=status.HTTP_201_CREATED)
def assign_talents_to_user(
    user_id: int,
    talents: List[UserTalentCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
    language: str = Query("en", min_length=2, max_length=10),
):
    """
    Assign Top 5 talents to user (admin, manager, or coach).
    
    - Replaces existing talents
    - Validates rank (1-5)
    - Validates talent IDs
    """
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access (supports cross-org for coaches)
    if not check_org_access(db, current_user, user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Validate talents count (should be exactly 5)
    if len(talents) != 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must assign exactly 5 talents"
        )
    
    # Validate ranks (1-5, unique)
    ranks = [t.rank for t in talents]
    if set(ranks) != {1, 2, 3, 4, 5}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ranks must be 1-5 and unique"
        )
    
    # Validate talent IDs exist
    talent_ids = [t.talent_id for t in talents]
    existing_talents = db.query(Talent).filter(Talent.id.in_(talent_ids)).all()
    if len(existing_talents) != 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more talent IDs are invalid"
        )
    
    # Delete existing user talents
    db.query(UserTalent).filter(UserTalent.user_id == user_id).delete()
    
    # Create new user talents
    user_talents = []
    for talent_data in talents:
        user_talent = UserTalent(
            user_id=user_id,
            talent_id=talent_data.talent_id,
            rank=talent_data.rank
        )
        db.add(user_talent)
        user_talents.append(user_talent)
    
    db.commit()
    
    # Refresh to get talent relationships
    for ut in user_talents:
        db.refresh(ut)

    response_payload: List[UserTalentResponse] = []
    for ut in user_talents:
        translation = _fetch_translation(db, ut.talent_id, language)
        if not translation:
            continue
        response_payload.append(
            UserTalentResponse(
                id=ut.id,
                talent_id=ut.talent_id,
                rank=ut.rank,
                talent=_build_talent_response(ut.talent, translation),
            )
        )

    return response_payload


@router.get("/users/{user_id}/talents", response_model=List[UserTalentResponse])
def get_user_talents(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    language: str = Query("en", min_length=2, max_length=10),
):
    """
    Get user's Top 5 talents.
    
    - Ordered by rank
    """
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access
    if not check_org_access(db, current_user, user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    user_talents = db.query(UserTalent).filter(
        UserTalent.user_id == user_id
    ).order_by(UserTalent.rank).all()
    
    response_payload: List[UserTalentResponse] = []
    for ut in user_talents:
        translation = _fetch_translation(db, ut.talent_id, language)
        if not translation:
            continue
        response_payload.append(
            UserTalentResponse(
                id=ut.id,
                talent_id=ut.talent_id,
                rank=ut.rank,
                talent=_build_talent_response(ut.talent, translation),
            )
        )

    return response_payload


@router.get("/users/{user_id}/domains", response_model=DomainDistribution)
def get_user_domain_distribution(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user's talent distribution across 4 Gallup domains.
    
    - Aggregates Top 5 talents by domain
    - Returns count per domain
    """
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access
    if user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Get user talents with talent info
    user_talents = db.query(UserTalent).join(Talent).filter(
        UserTalent.user_id == user_id
    ).all()
    
    # Count by domain
    distribution = DomainDistribution()
    for ut in user_talents:
        domain = ut.talent.domain
        if domain == GallupDomain.EXECUTING:
            distribution.executing += 1
        elif domain == GallupDomain.INFLUENCING:
            distribution.influencing += 1
        elif domain == GallupDomain.RELATIONSHIP_BUILDING:
            distribution.relationship_building += 1
        elif domain == GallupDomain.STRATEGIC_THINKING:
            distribution.strategic_thinking += 1
    
    return distribution
