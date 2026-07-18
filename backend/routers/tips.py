"""Tips router — daily actionable insights and team synergy tips."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openai import OpenAIError
from sqlalchemy.orm import Session

from auth import get_current_user, check_user_access
from database import SessionLocal, get_db
from models import AITip, User
from schemas import DailyTipResponse, SynergyTipResponse, TipFeedbackRequest
from services.assistant_service import stream_answer_chunks
from services.settings_service import get_setting
from services.sse import sse_event
from services.tips_service import (
    generate_daily_tip,
    generate_synergy_tip,
    prepare_daily_tip,
    prepare_synergy_tip,
    save_tip,
)

router = APIRouter(prefix="/tips", tags=["tips"])
logger = logging.getLogger(__name__)

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _stream_tip_events(
    prep: dict,
    user_id: int,
    talent_focus: str,
    context: str,
    meta: dict,
    streaming_enabled: bool,
):
    """Shared SSE generator for daily and synergy tips.

    Runs after the request-scoped session may be closed — uses a fresh
    SessionLocal only for the final save.
    """
    answer_text = ""
    try:
        yield sse_event("meta", meta)

        if not prep["ready"]:
            # No talents: emit informational content, nothing to persist
            yield sse_event("delta", {"text": prep["content"]})
            yield sse_event("done", {"tip_id": None, "content": prep["content"]})
            return

        if streaming_enabled:
            for chunk in stream_answer_chunks(
                prep["model_name"], prep["messages"], temperature=prep["temperature"]
            ):
                answer_text += chunk
                yield sse_event("delta", {"text": chunk})
        else:
            from services.assistant_service import get_openrouter_client
            client = get_openrouter_client()
            response = client.chat.completions.create(
                model=prep["model_name"],
                messages=prep["messages"],
                temperature=prep["temperature"],
            )
            answer_text = response.choices[0].message.content
            yield sse_event("delta", {"text": answer_text})

        answer_text = (answer_text or "").strip()
        if not answer_text:
            yield sse_event("error", {"detail": "Pusta odpowiedź modelu. Spróbuj ponownie."})
            return

        session = SessionLocal()
        try:
            tip_id = save_tip(session, user_id, answer_text, talent_focus, context)
        finally:
            session.close()

        yield sse_event("done", {"tip_id": tip_id, "content": answer_text})
    except OpenAIError as e:
        logger.error(f"Tips streaming error: {e}")
        yield sse_event("error", {"detail": "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę."})
    except Exception as e:
        logger.exception(f"Unexpected error during tips stream: {e}")
        yield sse_event("error", {"detail": "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."})


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

    result = generate_daily_tip(db, current_user, context=context, language=current_user.language or "pl")
    return DailyTipResponse(**result)


@router.get("/daily/stream")
def get_daily_tip_stream(
    context: str = Query("general", description="Tip context: general, feedback, one_on_one, conflict, motivation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming variant of /daily.

    Events: meta {talent_focus, context} -> delta {text}* -> done {tip_id, content} | error {detail}
    """
    valid_contexts = {"general", "feedback", "one_on_one", "conflict", "motivation"}
    if context not in valid_contexts:
        context = "general"

    language = current_user.language or "pl"
    prep = prepare_daily_tip(db, current_user, context=context, language=language)
    streaming_enabled = get_setting(db, "qa_streaming_enabled").lower() == "true"

    meta = {
        "talent_focus": prep.get("talent_focus", ""),
        "context": context,
    }
    return StreamingResponse(
        _stream_tip_events(
            prep, current_user.id, prep.get("talent_focus", ""), context, meta, streaming_enabled
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


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

    # Restricts USER-role callers to teammates only, even within the same
    # coach-workspace organization (see check_user_access docstring).
    if not check_user_access(db, current_user, target_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony w Twojej organizacji.",
        )

    result = generate_synergy_tip(db, current_user, target_user, language=current_user.language or "pl")
    return SynergyTipResponse(**result)


@router.get("/synergy/{target_user_id}/stream")
def get_synergy_tip_stream(
    target_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming variant of /synergy/{id}.

    The deterministic compare payload (shared talents, synergy score, domain
    balance, collaboration tips) is sent immediately in the `meta` event so the
    UI renders it before the AI guide finishes streaming.

    Events: meta {compare payload} -> delta {text}* -> done {tip_id, content} | error {detail}
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
    if not target_user or not check_user_access(db, current_user, target_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie został znaleziony w Twojej organizacji.",
        )

    language = current_user.language or "pl"
    prep = prepare_synergy_tip(db, current_user, target_user, language=language)
    streaming_enabled = get_setting(db, "qa_streaming_enabled").lower() == "true"

    meta = prep.get("compare") or {
        "target_user_name": target_user.full_name,
        "shared_talents": [],
        "synergy_score": 0,
        "collaboration_tips": [],
        "domain_balance": [],
    }
    return StreamingResponse(
        _stream_tip_events(
            prep, current_user.id, f"synergy:{target_user.id}", "synergy", meta, streaming_enabled
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


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
