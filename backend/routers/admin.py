"""Admin routes for knowledge and settings management."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import uuid

from auth import hash_password, require_role
from database import get_db
from models import AnswerReview, GeneratedAnswer, KnowledgeItem, ReviewStatus, UserQuery, User, UserRole, Organization, OrganizationAccess
from schemas import (
    AdminSettingUpdate,
    AdminSettingsResponse,
    AdminRoleUpdate,
    AdminOrgAccessToggle,
    AdminUserCreate,
    UserResponse,
    OrganizationResponse,
    KnowledgeItemBulkCreate,
    KnowledgeItemBulkResponse,
    KnowledgeItemCreate,
    KnowledgeItemUpdate,
    KnowledgeItemResponse,
    QueryReviewResponse,
    ReviewUpdate,
)
from services.assistant_service import get_embedding
from services.settings_service import get_all_settings, upsert_setting

router = APIRouter()


# -------- User Management --------

@router.get("/users", response_model=list[UserResponse])
def list_all_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """List all users in the system (Superadmin only)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    
    # Load organization accesses for coaches manually to populate the new schema field
    for u in users:
        if u.role.value == "coach":
            accesses = db.query(OrganizationAccess).filter(OrganizationAccess.user_id == u.id).all()
            u.organizations_access = [acc.organization_id for acc in accesses]
        else:
            u.organizations_access = []

    return users


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Create a new user (Superadmin only).

    For non-admin roles, organization_id is required. For admin role, it falls
    back to the creating admin's organization_id when omitted.
    """
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = UserRole(payload.role.value)
    organization_id = payload.organization_id
    roles_without_default_org = {UserRole.ADMIN, UserRole.COACH}
    if role not in roles_without_default_org and organization_id is None:
        raise HTTPException(
            status_code=422,
            detail="organization_id is required for this role",
        )
    if organization_id is None:
        organization_id = current_user.organization_id

    if not db.query(Organization).filter(Organization.id == organization_id).first():
        raise HTTPException(status_code=404, detail="Organization not found")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=role,
        organization_id=organization_id,
        public_token=str(uuid.uuid4()).replace("-", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user.organizations_access = []
    return user


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    payload: AdminRoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Change user role (Superadmin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = payload.role
    db.commit()
    db.refresh(user)
    
    # Reload access if coach
    if user.role.value == "coach":
        accesses = db.query(OrganizationAccess).filter(OrganizationAccess.user_id == user.id).all()
        user.organizations_access = [acc.organization_id for acc in accesses]
    else:
        user.organizations_access = []
        
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_profile(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Update user profile fields (Superadmin only).

    Accepts: full_name, email, is_active, job_title.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_fields = {"full_name", "email", "is_active", "job_title"}
    for key, value in payload.items():
        if key in allowed_fields:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)

    if user.role.value == "coach":
        accesses = db.query(OrganizationAccess).filter(OrganizationAccess.user_id == user.id).all()
        user.organizations_access = [acc.organization_id for acc in accesses]
    else:
        user.organizations_access = []

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Delete a user permanently (Superadmin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    db.delete(user)
    db.commit()
    return None


@router.get("/organizations", response_model=list[OrganizationResponse])
def list_all_organizations(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """List all organizations in the system."""
    return db.query(Organization).order_by(Organization.name).all()


@router.post("/users/{user_id}/organization-access", response_model=list[int])
def toggle_organization_access(
    user_id: int,
    payload: AdminOrgAccessToggle,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Grant or revoke access to an organization for a coach."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role.value != "coach":
        raise HTTPException(status_code=400, detail="Organization access can only be managed for coaches")
        
    # Check if organization exists
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    existing_access = db.query(OrganizationAccess).filter(
        OrganizationAccess.user_id == user_id,
        OrganizationAccess.organization_id == payload.organization_id
    ).first()
    
    if payload.has_access and not existing_access:
        # Grant access
        new_access = OrganizationAccess(
            user_id=user_id,
            organization_id=payload.organization_id,
            granted_by=current_user.id
        )
        db.add(new_access)
    elif not payload.has_access and existing_access:
        # Revoke access
        db.delete(existing_access)
        
    db.commit()
    
    # Return updated list of org IDs the user has access to
    accesses = db.query(OrganizationAccess).filter(OrganizationAccess.user_id == user_id).all()
    return [acc.organization_id for acc in accesses]


# -------- End User Management --------


def _build_metadata(explicit_meta: dict, category: str, tags: list[str]) -> dict:
    """Auto-build metadata_json from form fields.
    
    Extracts structured metadata (domain, content_type, talent_code, talent_name_pl,
    talent_name_en) from the explicit metadata dict and merges with auto-derived values.
    Frontend sends these fields explicitly; this function ensures consistency.
    """
    meta = dict(explicit_meta)  # copy

    # Ensure key fields exist (frontend should send them, but provide fallbacks)
    meta.setdefault("domain", "")
    meta.setdefault("content_type", "")
    meta.setdefault("talent_code", "")
    meta.setdefault("talent_name_pl", "")
    meta.setdefault("talent_name_en", "")

    # Auto-derive category from the category field if not set
    if not meta.get("category"):
        meta["category"] = category

    # Auto-derive tags snapshot
    meta["tags"] = tags

    # Clean up empty string values
    return {k: v for k, v in meta.items() if v != "" and v != []}


@router.get("/queries", response_model=list[QueryReviewResponse])
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


@router.patch("/answers/{answer_id}")
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
            title=query.question,
            category="FAQ",
            tags=[],
            section="faq",
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


@router.post("/knowledge", response_model=KnowledgeItemResponse)
def create_knowledge(
    payload: KnowledgeItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    embedding = get_embedding(db, payload.content)
    metadata = _build_metadata(payload.metadata_json, payload.category, payload.tags)
    knowledge_item = KnowledgeItem(
        title=payload.title,
        category=payload.category,
        tags=payload.tags,
        section=payload.section,
        content=payload.content,
        embedding=embedding,
        language=payload.language,
        organization_id=None,
        created_by=current_user.id,
        metadata_json=metadata,
    )
    db.add(knowledge_item)
    db.commit()
    db.refresh(knowledge_item)
    return knowledge_item


@router.post("/knowledge/bulk", response_model=KnowledgeItemBulkResponse)
def create_knowledge_bulk(
    payload: KnowledgeItemBulkCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Bulk import multiple knowledge items in a single request.
    Processes all items and returns created items + any per-item errors.
    """
    created_items = []
    errors = []

    for idx, item in enumerate(payload.items):
        try:
            embedding = get_embedding(db, item.content)
            metadata = _build_metadata(item.metadata_json, item.category, item.tags)
            knowledge_item = KnowledgeItem(
                title=item.title,
                category=item.category,
                tags=item.tags,
                section=item.section,
                content=item.content,
                embedding=embedding,
                language=item.language,
                organization_id=None,
                created_by=current_user.id,
                metadata_json=metadata,
            )
            db.add(knowledge_item)
            db.flush()
            db.refresh(knowledge_item)
            created_items.append(knowledge_item)
        except Exception as e:
            errors.append(f"Item {idx} '{item.title}': {str(e)}")
            db.rollback()

    if created_items:
        db.commit()

    return KnowledgeItemBulkResponse(
        created=len(created_items),
        errors=errors,
        items=created_items,
    )


@router.get("/knowledge", response_model=list[KnowledgeItemResponse])
def list_knowledge(
    section: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    query = db.query(KnowledgeItem).filter(KnowledgeItem.organization_id.is_(None))
    if section:
        query = query.filter(KnowledgeItem.section == section)
    return query.order_by(KnowledgeItem.created_at.desc()).all()


@router.patch("/knowledge/{knowledge_id}", response_model=KnowledgeItemResponse)
def update_knowledge(
    knowledge_id: int,
    payload: KnowledgeItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    knowledge_item = (
        db.query(KnowledgeItem)
        .filter(KnowledgeItem.id == knowledge_id, KnowledgeItem.organization_id.is_(None))
        .first()
    )
    if not knowledge_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge item not found")

    if payload.title is not None:
        knowledge_item.title = payload.title
    if payload.category is not None:
        knowledge_item.category = payload.category
    if payload.tags is not None:
        knowledge_item.tags = payload.tags
    if payload.section is not None:
        knowledge_item.section = payload.section
    if payload.language is not None:
        knowledge_item.language = payload.language
    if payload.is_active is not None:
        knowledge_item.is_active = payload.is_active
    if payload.metadata_json is not None:
        knowledge_item.metadata_json = _build_metadata(
            payload.metadata_json,
            payload.category or knowledge_item.category,
            payload.tags if payload.tags is not None else knowledge_item.tags,
        )
    if payload.content is not None and payload.content != knowledge_item.content:
        knowledge_item.content = payload.content
        knowledge_item.embedding = get_embedding(db, payload.content)

    db.commit()
    db.refresh(knowledge_item)
    return knowledge_item


@router.get("/settings", response_model=AdminSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    return AdminSettingsResponse(settings=get_all_settings(db))


@router.patch("/settings", response_model=AdminSettingsResponse)
def update_settings(
    payload: list[AdminSettingUpdate],
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    for item in payload:
        upsert_setting(db, item.key, item.value, updated_by=current_user.id)
    db.commit()
    return AdminSettingsResponse(settings=get_all_settings(db))
