"""Admin routes for knowledge and settings management."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models import AnswerReview, GeneratedAnswer, KnowledgeItem, ReviewStatus, UserQuery
from schemas import (
    AdminSettingUpdate,
    AdminSettingsResponse,
    KnowledgeItemCreate,
    KnowledgeItemResponse,
    QueryReviewResponse,
    ReviewUpdate,
)
from services.assistant_service import get_embedding
from services.settings_service import get_all_settings, upsert_setting

router = APIRouter()


@router.get("/admin/queries", response_model=list[QueryReviewResponse])
def list_pending_queries(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    results = (
        db.query(UserQuery, GeneratedAnswer, AnswerReview)
        .join(GeneratedAnswer, GeneratedAnswer.query_id == UserQuery.id)
        .join(AnswerReview, AnswerReview.generated_answer_id == GeneratedAnswer.id)
        .filter(
            UserQuery.organization_id == current_user.organization_id,
            AnswerReview.status == ReviewStatus.PENDING,
        )
        .order_by(UserQuery.created_at.desc())
        .all()
    )
    response = []
    for query, answer, review in results:
        response.append(
            QueryReviewResponse(
                query_id=query.id,
                question=query.question,
                language=query.language,
                created_at=query.created_at,
                answer_id=answer.id,
                answer_text=answer.answer_text,
                model_name=answer.model_name,
                status=review.status,
                edited_text=review.edited_text,
            )
        )
    return response


@router.patch("/admin/answers/{answer_id}")
def review_answer(
    answer_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    # Join with UserQuery to verify organization ownership
    result = (
        db.query(GeneratedAnswer, UserQuery)
        .join(UserQuery, GeneratedAnswer.query_id == UserQuery.id)
        .filter(
            GeneratedAnswer.id == answer_id,
            UserQuery.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    
    answer, query = result

    review = (
        db.query(AnswerReview)
        .filter(AnswerReview.generated_answer_id == answer.id)
        .first()
    )
    if not review:
        review = AnswerReview(generated_answer_id=answer.id, status=ReviewStatus.PENDING)
        db.add(review)

    review.status = ReviewStatus(payload.status.value)
    review.edited_text = payload.edited_text
    review.reviewed_by = current_user.id
    review.reviewed_at = datetime.utcnow()

    if review.status == ReviewStatus.APPROVED:
        # Use query from the join above (line 78)
        content = review.edited_text or answer.answer_text
        embedding = get_embedding(db, content)
        knowledge_item = KnowledgeItem(
            content=content,
            embedding=embedding,
            language=query.language,
            organization_id=None,
            created_by=current_user.id,
            source_query_id=query.id,
            metadata_json={"source": "generated_answer", "query_id": query.id},
        )
        db.add(knowledge_item)

    db.commit()
    return {"status": review.status.value}


@router.post("/admin/knowledge", response_model=KnowledgeItemResponse)
def create_knowledge(
    payload: KnowledgeItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    embedding = get_embedding(db, payload.content)
    knowledge_item = KnowledgeItem(
        content=payload.content,
        embedding=embedding,
        language=payload.language,
        organization_id=None,
        created_by=current_user.id,
        metadata_json=payload.metadata_json,
    )
    db.add(knowledge_item)
    db.commit()
    db.refresh(knowledge_item)
    return knowledge_item


@router.get("/admin/settings", response_model=AdminSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    return AdminSettingsResponse(settings=get_all_settings(db))


@router.patch("/admin/settings", response_model=AdminSettingsResponse)
def update_settings(
    payload: list[AdminSettingUpdate],
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    for item in payload:
        upsert_setting(db, item.key, item.value, updated_by=current_user.id)
    db.commit()
    return AdminSettingsResponse(settings=get_all_settings(db))
