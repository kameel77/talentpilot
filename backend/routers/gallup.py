"""Gallup PDF parsing endpoints."""

from __future__ import annotations

import os
import tempfile
from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends
from sqlalchemy.orm import Session

from schemas import GallupPdfParseResponse
from services.gallup_pdf_parser import extract_gallup_rankings
from auth import get_current_user
from database import get_db
from models import User, Talent, TalentTranslation

router = APIRouter()


@router.post("/gallup/parse-pdf", response_model=GallupPdfParseResponse, status_code=status.HTTP_200_OK)
def parse_gallup_pdf(
    file: UploadFile = File(...),
    language: str = "pl",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> GallupPdfParseResponse:
    """Parse Gallup PDF and return rankings with detected page index and translations."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        try:
            tmp.write(file.file.read())
            temp_path = tmp.name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read upload: {str(e)}")

    try:
        rankings, page_index = extract_gallup_rankings(temp_path)
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
        language=language
    )
