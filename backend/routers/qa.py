"""QA v1 router for Talent->Competency->Action flow."""
import json
import logging
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import GeneratedAnswer, UserFeedback, UserQuery, ReviewStatus
from schemas import (
    QAAnswer,
    QAFeedbackRequest,
    QAHistoryItem,
    QAQueryRequest,
    QAQueryResponse,
)
from services.assistant_service import (
    compute_question_hash,
    find_similar_query,
    generate_answer,
    get_embedding,
    get_user_in_organization,
    get_user_talents,
    retrieve_knowledge,
)
from services.settings_service import get_setting

router = APIRouter(prefix="/v1/qa", tags=["qa-v1"])
logger = logging.getLogger(__name__)


def parse_structured_answer(text: str) -> QAAnswer:
    """Parse raw LLM text into Talent/Competency/Action structure.
    
    Expected format (roughly):
    Talent: [Talent Name]
    Kompetencja: [Business Competency]
    Akcja:
    1) Step 1
    2) Step 2
    """
    talent = "General"
    competency = "General Management"
    actions = []
    fallback = False

    try:
        logger.info(f"--- PARSING LLM TEXT ---\n{text}")
        # Simple regex-based parsing
        talent_match = re.search(r"Talent:\s*(.*)", text, re.IGNORECASE)
        if talent_match:
            talent = talent_match.group(1).split("\n")[0].strip()
        
        comp_match = re.search(r"Kompetencja:\s*(.*)", text, re.IGNORECASE)
        if comp_match:
            competency = comp_match.group(1).split("\n")[0].strip()
            
        # Actions - look for numbered list or bullet points
        action_parts = re.split(r"Akcja:\s*", text, flags=re.IGNORECASE)
        if len(action_parts) > 1:
            actions_text = action_parts[1]
            # Match 1) or - or *
            items = re.findall(r"(?:^\d+[\)\.]\s*|^\-\s*|^[•*]\s*)(.*)", actions_text, re.MULTILINE)
            actions = [i.strip() for i in items if i.strip()]
        
        # Clean up keys if LLM included them in text (sometimes happens with weak models)
        talent = re.sub(r"^\*\*|\*\*$|^\[|\]$", "", talent)
        competency = re.sub(r"^\*\*|\*\*$|^\[|\]$", "", competency)
        
        if not actions:
            # Fallback if parsing fails but text exists
            actions = [line.strip() for line in text.split("\n") if line.strip() and len(line) > 10][:3]
            fallback = True

    except Exception as e:
        logger.error(f"Error parsing structured answer: {e}")
        fallback = True
        actions = ["Nie udało się sformatować odpowiedzi, skontaktuj się z administratorem."]

    return QAAnswer(
        talent=talent,
        competency=competency,
        actions=actions,
        fallback=fallback
    )


@router.post("/query", response_model=QAQueryResponse)
def query_qa(
    request: QAQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logger.info(f"--- QA QUERY START --- User: {current_user.email}, Q: {request.question}, Context: {request.context}")
    
    language = request.language or "pl"
    target_user_id = request.target_user_id or current_user.id
    target_user = get_user_in_organization(db, target_user_id, current_user.organization_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Reuse logic for history/caching if needed
    question_hash = compute_question_hash(request.question)
    
    # DEBUG: Temporarily commented out cache to force regeneration
    # existing_query = (
    #     db.query(UserQuery)
    #     .filter(
    #         UserQuery.organization_id == current_user.organization_id,
    #         UserQuery.question_hash == question_hash,
    #         UserQuery.language == language,
    #     )
    #     .order_by(UserQuery.created_at.desc())
    #     .first()
    # )
    # 
    # if existing_query:
    #     existing_answer = (
    #         db.query(GeneratedAnswer)
    #         .filter(GeneratedAnswer.query_id == existing_query.id)
    #         .first()
    #     )
    #     if existing_answer:
    #         logger.info(f"--- QA CACHE HIT --- Query ID: {existing_query.id}")
    #         return QAQueryResponse(
    #             query_id=existing_query.id,
    #             answer_id=existing_answer.id,
    #             answer=parse_structured_answer(existing_answer.answer_text)
    #         )

    # Generate new
    query_embedding = get_embedding(db, request.question)
    
    user_query = UserQuery(
        user_id=current_user.id,
        target_user_id=target_user.id,
        organization_id=current_user.organization_id,
        question=request.question,
        question_hash=question_hash,
        embedding=query_embedding,
        language=language,
        is_unique=True,
    )
    db.add(user_query)
    db.flush()

    talents = get_user_talents(db, target_user.id, language)
    knowledge_items = retrieve_knowledge(db, current_user.organization_id, query_embedding, language)
    
    answer_text, model_name = generate_answer(
        db,
        request.question,
        talents,
        knowledge_items,
        language,
    )
    
    sources = [item.id for item in knowledge_items]
    generated_answer = GeneratedAnswer(
        query_id=user_query.id,
        answer_text=answer_text,
        model_name=model_name,
        sources=sources,
    )
    db.add(generated_answer)
    db.commit()

    return QAQueryResponse(
        query_id=user_query.id,
        answer_id=generated_answer.id,
        answer=parse_structured_answer(answer_text)
    )


@router.post("/feedback")
def save_feedback(
    request: QAFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify ownership/access
    query = db.query(UserQuery).filter(
        UserQuery.id == request.query_id,
        UserQuery.organization_id == current_user.organization_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    feedback = UserFeedback(
        query_id=request.query_id,
        answer_id=request.answer_id,
        user_id=current_user.id,
        rating=request.rating,
        is_effective=request.is_effective,
        comment=request.comment
    )
    db.add(feedback)
    db.commit()
    return {"status": "ok"}


@router.get("/history", response_model=list[QAHistoryItem])
def get_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Fetch user's queries joined with answers
    results = (
        db.query(UserQuery, GeneratedAnswer)
        .join(GeneratedAnswer, GeneratedAnswer.query_id == UserQuery.id)
        .filter(UserQuery.user_id == current_user.id)
        .order_by(UserQuery.created_at.desc())
        .limit(20)
        .all()
    )
    
    history = []
    for q, a in results:
        history.append(QAHistoryItem(
            query_id=q.id,
            question=q.question,
            context="self" if q.target_user_id == q.user_id else "team",
            answer=parse_structured_answer(a.answer_text),
            created_at=q.created_at
        ))
    
    return history
