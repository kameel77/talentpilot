"""Talents router for listing talents and assigning them to users."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import nulls_last
from typing import List

from database import get_db
from models import User, Talent, UserTalent, GallupDomain
from schemas import (
    TalentResponse,
    TalentOrderUpdate,
    UserTalentCreate,
    UserTalentResponse,
    DomainDistribution
)
from auth import get_current_user, require_role

router = APIRouter()


@router.get("/talents", response_model=List[TalentResponse])
def list_talents(db: Session = Depends(get_db)):
    """
    List all 34 CliftonStrengths talents.
    
    - Public endpoint (no auth required for reading talents)
    - Ordered by Gallup order number when provided
    """
    talents = db.query(Talent).order_by(
        nulls_last(Talent.order_number),
        Talent.domain,
        Talent.name
    ).all()
    return talents


@router.put("/talents/order-numbers", response_model=List[TalentResponse])
def update_talent_order_numbers(
    updates: List[TalentOrderUpdate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """
    Update Gallup order numbers for talents (admin only).
    
    - Accepts a list of talent name + order number pairs
    - Allows clearing the order number by sending null
    """
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates provided"
        )

    names = [update.name for update in updates]
    if len(set(names)) != len(names):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Talent names must be unique in the update payload"
        )

    order_numbers = [update.order_number for update in updates if update.order_number is not None]
    if len(set(order_numbers)) != len(order_numbers):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order numbers must be unique in the update payload"
        )

    invalid_numbers = [number for number in order_numbers if number < 1 or number > 34]
    if invalid_numbers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order numbers must be between 1 and 34"
        )

    talents = db.query(Talent).filter(Talent.name.in_(names)).all()
    if len(talents) != len(names):
        existing_names = {talent.name for talent in talents}
        missing = sorted(set(names) - existing_names)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Talents not found: {', '.join(missing)}"
        )

    if order_numbers:
        conflicts = db.query(Talent).filter(
            Talent.order_number.in_(order_numbers),
            ~Talent.name.in_(names)
        ).all()
        if conflicts:
            conflict_details = ", ".join(
                f"{talent.name} ({talent.order_number})" for talent in conflicts
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order numbers already assigned: {conflict_details}"
            )

    talents_by_name = {talent.name: talent for talent in talents}
    for update in updates:
        talent = talents_by_name[update.name]
        talent.order_number = update.order_number

    db.commit()

    updated_talents = db.query(Talent).order_by(
        nulls_last(Talent.order_number),
        Talent.domain,
        Talent.name
    ).all()
    return updated_talents


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
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    """
    Assign Top 5 talents to user (admin or manager).
    
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
    
    # Check organization access
    if user.organization_id != current_user.organization_id:
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
    
    return user_talents


@router.get("/users/{user_id}/talents", response_model=List[UserTalentResponse])
def get_user_talents(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    if user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    user_talents = db.query(UserTalent).filter(
        UserTalent.user_id == user_id
    ).order_by(UserTalent.rank).all()
    
    return user_talents


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
