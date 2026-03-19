"""Tips router — daily actionable insights and team synergy tips."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AITip, User
from schemas import DailyTipResponse, SynergyTipResponse, TipFeedbackRequest
from services.tips_service import generate_daily_tip, generate_synergy_tip

router = APIRouter(prefix="/tips", tags=["tips"])


@router.get("/daily", response_model=DailyTipResponse)
def get_daily_tip(
    context: str = Query("general", description="Tip context: general, feedback, one_on_one, conflict, motivation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an AI-powered daily tip based on user's talents.
    
    Context options:
    - general: ogólna wskazówka na dziś
    - feedback: przygotowanie do dawania/odbierania feedbacku
    - one_on_one: przygotowanie do spotkania 1:1
    - conflict: radzenie sobie z konfliktem
    - motivation: odzyskanie motywacji
    """
    valid_contexts = {"general", "feedback", "one_on_one", "conflict", "motivation"}
    if context not in valid_contexts:
        context = "general"

    result = generate_daily_tip(db, current_user, context=context)
    return DailyTipResponse(**result)


@router.get("/synergy/{target_user_id}", response_model=SynergyTipResponse)
def get_synergy_tip(
    target_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a synergy tip for interacting with a specific team member.
    
    Combines deterministic compare data with AI-generated interaction guide.
    """
    if target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz wygenerować wskazówki relacji z samym sobą.",
        )

    target_user = db.query(User).filter(
        User.id == target_user_id,
        User.organization_id == current_user.organization_id,
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony w Twojej organizacji.",
        )

    result = generate_synergy_tip(db, current_user, target_user)
    return SynergyTipResponse(**result)


@router.post("/feedback")
def submit_tip_feedback(
    request: TipFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback (helpful/not helpful) for a tip."""
    tip = db.query(AITip).filter(
        AITip.id == request.tip_id,
        AITip.user_id == current_user.id,
    ).first()

    if not tip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wskazówka nie została znaleziona.",
        )

    tip.helpful = request.helpful
    db.commit()
    return {"status": "ok"}
