"""Gallup PDF parsing endpoints."""

from __future__ import annotations

import os
import tempfile
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from schemas import GallupPdfParseResponse
from services.gallup_pdf_parser import extract_gallup_rankings

router = APIRouter()


@router.post("/gallup/parse-pdf", response_model=GallupPdfParseResponse, status_code=status.HTTP_200_OK)
def parse_gallup_pdf(file: UploadFile = File(...)) -> GallupPdfParseResponse:
    """Parse Gallup PDF and return rankings with detected page index."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file.file.read())
        temp_path = tmp.name

    try:
        rankings, page_index = extract_gallup_rankings(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return GallupPdfParseResponse(page_index=page_index, rankings=rankings)
