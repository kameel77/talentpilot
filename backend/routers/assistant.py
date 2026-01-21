"""Assistant routes for LLM-powered tips and answers."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import AnswerReview, GeneratedAnswer, ReviewStatus, UserQuery
from schemas import AssistantQueryRequest, AssistantQueryResponse
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

router = APIRouter()


def pick_answer_text(db: Session, generated_answer: GeneratedAnswer) -> str:
    review = (
        db.query(AnswerReview)
        .filter(AnswerReview.generated_answer_id == generated_answer.id)
        .first()
    )
    if review and review.status == ReviewStatus.APPROVED and review.edited_text:
        return review.edited_text
    return generated_answer.answer_text


@router.post("/assistant/query", response_model=AssistantQueryResponse)
def query_assistant(
    request: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    language = request.language or "pl"
    target_user_id = request.target_user_id or current_user.id
    target_user = get_user_in_organization(db, target_user_id, current_user.organization_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    daily_limit_raw = get_setting(db, "daily_query_limit")
    if daily_limit_raw:
        daily_limit = int(daily_limit_raw)
        if daily_limit > 0:
            since = datetime.utcnow() - timedelta(hours=24)
            usage_count = (
                db.query(UserQuery)
                .filter(
                    UserQuery.user_id == current_user.id,
                    UserQuery.created_at >= since,
                )
                .count()
            )
            if usage_count >= daily_limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Daily query limit exceeded.",
                )

    question_hash = compute_question_hash(request.question)
    existing_query = (
        db.query(UserQuery)
        .filter(
            UserQuery.organization_id == current_user.organization_id,
            UserQuery.question_hash == question_hash,
            UserQuery.language == language,
        )
        .order_by(UserQuery.created_at.desc())
        .first()
    )
    if existing_query:
        existing_answer = (
            db.query(GeneratedAnswer)
            .filter(GeneratedAnswer.query_id == existing_query.id)
            .order_by(GeneratedAnswer.created_at.desc())
            .first()
        )
        if existing_answer:
            return AssistantQueryResponse(
                query_id=existing_query.id,
                answer_id=existing_answer.id,
                answer_text=pick_answer_text(db, existing_answer),
                model_name=existing_answer.model_name,
            )

    query_embedding = get_embedding(db, request.question)
    similar_query = find_similar_query(
        db,
        current_user.organization_id,
        query_embedding,
        language,
        threshold=0.9,
    )

    user_query = UserQuery(
        user_id=current_user.id,
        target_user_id=target_user.id,
        organization_id=current_user.organization_id,
        question=request.question,
        question_hash=question_hash,
        embedding=query_embedding,
        language=language,
        is_unique=similar_query is None,
        matched_query_id=similar_query.id if similar_query else None,
    )
    db.add(user_query)
    db.flush()

    if similar_query:
        similar_answer = (
            db.query(GeneratedAnswer)
            .filter(GeneratedAnswer.query_id == similar_query.id)
            .order_by(GeneratedAnswer.created_at.desc())
            .first()
        )
        if similar_answer:
            db.commit()
            return AssistantQueryResponse(
                query_id=user_query.id,
                answer_id=similar_answer.id,
                answer_text=pick_answer_text(db, similar_answer),
                model_name=similar_answer.model_name,
            )

    talents = get_user_talents(db, target_user.id, language)
    knowledge_items = retrieve_knowledge(
        db,
        current_user.organization_id,
        query_embedding,
        language,
    )
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
    db.flush()

    review = AnswerReview(
        generated_answer_id=generated_answer.id,
        status=ReviewStatus.PENDING,
    )
    db.add(review)

    db.commit()

    return AssistantQueryResponse(
        query_id=user_query.id,
        answer_id=generated_answer.id,
        answer_text=answer_text,
        model_name=model_name,
    )
