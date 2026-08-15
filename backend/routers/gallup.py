"""Gallup PDF parsing endpoints."""

from __future__ import annotations

import os
import tempfile
from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from schemas import GallupPdfParseResponse, UserTalentCreate, UserTalentResponse, TalentResponse, TalentTranslationResponse
from services.gallup_pdf_parser import extract_gallup_rankings
from auth import get_current_user, require_role, check_org_access
from database import get_db
from models import User, UserRole, Talent, TalentTranslation, UserTalent
from services.plan_limits import assert_within_limit

router = APIRouter()


@router.post("/gallup/parse-pdf", response_model=GallupPdfParseResponse, status_code=status.HTTP_200_OK)
def parse_gallup_pdf(
    file: UploadFile = File(...),
    language: str = "pl",
    intent: str = Query("existing", pattern="^(new_profile|existing)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> GallupPdfParseResponse:
    """Parse Gallup PDF and return rankings with detected page index and translations.
    
    `intent="new_profile"` checks the coach's plan profile limit upfront.
    `intent="existing"` (default) allows updating existing members or personal profile without limit errors.
    """
    if intent == "new_profile" and current_user.role == UserRole.COACH and current_user.organization is not None:
        assert_within_limit(db, current_user.organization, "profiles")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        try:
            tmp.write(file.file.read())
            temp_path = tmp.name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read upload: {str(e)}")

    try:
        rankings, page_index, person_info = extract_gallup_rankings(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # Translate rankings to requested language
    translated_rankings = {}
    if rankings:
        # Get translations from DB
        talents = db.query(Talent).filter(Talent.code.in_(rankings.keys())).all()
        talent_ids = [t.id for t in talents]
        
        translations = db.query(TalentTranslation).filter(
            TalentTranslation.talent_id.in_(talent_ids),
            TalentTranslation.language == language
        ).all()
        
        translation_map = {t.talent.code: t.name for t in translations}
        
        for code, rank in rankings.items():
            translated_name = translation_map.get(code, code)
            translated_rankings[translated_name] = rank

    return GallupPdfParseResponse(
        page_index=page_index,
        rankings=rankings,
        translated_rankings=translated_rankings,
        language=language,
        first_name=person_info.first_name,
        last_name=person_info.last_name,
    )


class GallupSaveTalentsRequest(BaseModel):
    rankings: dict[str, int]  # talent_code -> rank
    language: str = "pl"


@router.post("/gallup/save-talents/{user_id}", response_model=List[UserTalentResponse], status_code=status.HTTP_201_CREATED)
def save_gallup_talents(
    user_id: int,
    request: GallupSaveTalentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    language: str = Query("en", min_length=2, max_length=10),
) -> List[UserTalentResponse]:
    """Save parsed Gallup rankings to user talents (replaces existing talents).
    
    Users can save their own talents. Admin/manager can save any user's talents.
    """
    # Get target user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access (supports cross-org for coaches)
    if not check_org_access(db, current_user, user.organization_id):  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Permission check: users can save their own talents, admin/manager/coach can save anyone's
    is_self = user_id == current_user.id  # type: ignore
    is_privileged = current_user.role in (UserRole.ADMIN, UserRole.MANAGER, UserRole.COACH)  # type: ignore
    
    if not is_self and not is_privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only save your own talents"
        )
    
    # Convert rankings (talent_code -> rank) to UserTalentCreate objects
    # Save all provided talents (not just top 5)
    sorted_rankings = sorted(request.rankings.items(), key=lambda x: x[1])
    
    # Get talent IDs from codes
    talent_codes = [code for code, _ in sorted_rankings]
    talents = db.query(Talent).filter(Talent.code.in_(talent_codes)).all()
    talent_code_to_id = {t.code: t.id for t in talents}
    
    if len(talents) != len(talent_codes):
        talent_codes_set = set(talent_codes)
        found_codes_set = set(str(k) for k in talent_code_to_id.keys())
        missing = talent_codes_set - found_codes_set
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid talent codes: {missing}"
        )
    
    user_talents_create = []
    for code, rank in sorted_rankings:
        user_talents_create.append(
            UserTalentCreate(talent_id=talent_code_to_id[code], rank=rank)  # type: ignore
        )
    
    # Delete existing user talents
    db.query(UserTalent).filter(UserTalent.user_id == user_id).delete()
    
    # Create new user talents
    user_talents = []
    for talent_data in user_talents_create:
        user_talent = UserTalent(
            user_id=user_id,
            talent_id=talent_data.talent_id,
            rank=talent_data.rank
        )
        db.add(user_talent)
        user_talents.append(user_talent)
    
    db.commit()
    
    # Refresh and build response
    def _fetch_translation(db: Session, talent_id: int, lang: str):
        return (
            db.query(TalentTranslation)
            .filter(
                TalentTranslation.talent_id == talent_id,
                TalentTranslation.language == lang,
            )
            .first()
        )
    
    def _build_talent_response(talent: Talent, translation: TalentTranslation):
        from schemas import TalentResponse, TalentTranslationResponse
        return TalentResponse(
            id=talent.id,  # type: ignore
            code=talent.code,  # type: ignore
            domain=talent.domain,  # type: ignore
            translation=TalentTranslationResponse.from_orm(translation),
        )
    
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
