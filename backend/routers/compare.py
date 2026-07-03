"""Compare router — 1:1 talent comparison between two users."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from auth import get_current_user, check_user_access
from database import get_db
from models import User
from schemas import CompareResponse, UserResponse
from services.compare_service import compare_users

router = APIRouter()


@router.get("/compare/{user_a_id}/{user_b_id}", response_model=CompareResponse)
def compare_two_users(
    user_a_id: int,
    user_b_id: int,
    language: Optional[str] = Query(None, description="Language for talent names"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compare talents of two users in the same organization.

    Returns shared talents, unique strengths, domain balance,
    synergy score, and collaboration tips.
    """
    language = language or current_user.language or "pl"

    if user_a_id == user_b_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można porównać użytkownika z samym sobą.",
        )

    user_a = db.query(User).filter(
        User.id == user_a_id,
        User.organization_id == current_user.organization_id,
    ).first()
    
    user_b = db.query(User).filter(
        User.id == user_b_id,
        User.organization_id == current_user.organization_id,
    ).first()

    if not user_a:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Użytkownik A (id={user_a_id}) nie został znaleziony w Twojej organizacji.",
        )

    if not user_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Użytkownik B (id={user_b_id}) nie został znaleziony w Twojej organizacji.",
        )

    # Both users must be individually accessible to the caller — restricts
    # USER-role callers to self/teammates even within the same coach-workspace
    # organization, where unrelated individual clients can otherwise collide.
    if not check_user_access(db, current_user, user_a) or not check_user_access(db, current_user, user_b):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony w Twojej organizacji.",
        )

    result = compare_users(db, user_a, user_b, language=language)

    return CompareResponse(
        user_a=UserResponse.model_validate(user_a),
        user_b=UserResponse.model_validate(user_b),
        **result,
    )
