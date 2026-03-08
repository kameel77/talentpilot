"""External API endpoints for integrations."""

import os
import tempfile
from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Literal

from schemas import ExternalGallupResponse, ExternalTalent, ExternalTalentName, ExternalDomain
from services.gallup_pdf_parser import extract_gallup_rankings
from auth import verify_api_key
from database import get_db
from models import Talent, TalentTranslation, ApiKey

router = APIRouter()

DOMAIN_NUMBERS = {
    "executing": 1,
    "influencing": 2,
    "relationship_building": 3,
    "strategic_thinking": 4,
}

DOMAIN_NAMES_EN = {
    "executing": "Executing",
    "influencing": "Influencing",
    "relationship_building": "Relationship Building",
    "strategic_thinking": "Strategic Thinking",
}

DOMAIN_NAMES_PL = {
    "executing": "Realizowanie",
    "influencing": "Wywieranie wpływu",
    "relationship_building": "Budowanie relacji",
    "strategic_thinking": "Myślenie strategiczne",
}


@router.post(
    "/gallup/parse",
    response_model=ExternalGallupResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse Gallup PDF report",
    description="""
Upload a Gallup CliftonStrengths PDF report and receive structured talent data.

**Authentication:** pass your API key in the `X-API-Key` header.

**Language parameter:**
| Value   | Result                                      |
|---------|---------------------------------------------|
| `pl+en` | Both Polish and English names (default)     |
| `pl`    | Polish names only (`en` fields will be null)|
| `en`    | English names only (`pl` fields will be null)|

**Response fields:**
- `rank` — talent position in the report (1 = strongest, 34 = weakest)
- `talent` — internal talent code (e.g. `achiever`)
- `domain.number` — domain index: Executing=1, Influencing=2, Relationship Building=3, Strategic Thinking=4
- `domain.pl` / `domain.en` — domain name in the requested language(s)
- `name.pl` / `name.en` — talent name in the requested language(s)
""",
    responses={
        400: {"description": "Invalid file format (only PDF supported)"},
        401: {"description": "Missing API key"},
        403: {"description": "Invalid or inactive API key"},
    },
)
def parse_gallup_pdf_external(
    file: UploadFile = File(..., description="Gallup CliftonStrengths PDF report"),
    language: Literal["pl", "en", "pl+en"] = Query(
        "pl+en",
        description="Language for talent and domain names: `pl`, `en`, or `pl+en` (default)"
    ),
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(verify_api_key)
) -> ExternalGallupResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        try:
            tmp.write(file.file.read())
            temp_path = tmp.name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read upload: {str(e)}")

    try:
        rankings, _ = extract_gallup_rankings(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not rankings:
        return ExternalGallupResponse(language=language, talents=[])

    include_pl = language in ("pl", "pl+en")
    include_en = language in ("en", "pl+en")

    # Fetch talents and translations from DB
    talents = db.query(Talent).filter(Talent.code.in_(rankings.keys())).all()
    talent_ids = [t.id for t in talents]

    translations = db.query(TalentTranslation).filter(
        TalentTranslation.talent_id.in_(talent_ids)
    ).all()

    # Map: talent_id -> {language -> name}
    trans_map: dict = {}
    for t in translations:
        if t.talent_id not in trans_map:
            trans_map[t.talent_id] = {}
        trans_map[t.talent_id][t.language] = t.name

    external_talents = []

    for code, rank in sorted(rankings.items(), key=lambda x: x[1]):
        talent_obj = next((t for t in talents if t.code == code), None)
        if not talent_obj:
            continue

        t_id = talent_obj.id
        domain_val = talent_obj.domain.value

        name_pl = trans_map.get(t_id, {}).get("pl", code)
        name_en = trans_map.get(t_id, {}).get("en", code)

        external_talents.append(
            ExternalTalent(
                rank=rank,
                talent=code,
                domain=ExternalDomain(
                    number=DOMAIN_NUMBERS.get(domain_val, 0),
                    pl=DOMAIN_NAMES_PL.get(domain_val) if include_pl else None,
                    en=DOMAIN_NAMES_EN.get(domain_val) if include_en else None,
                ),
                name=ExternalTalentName(
                    pl=name_pl if include_pl else None,
                    en=name_en if include_en else None,
                ),
            )
        )

    return ExternalGallupResponse(language=language, talents=external_talents)
