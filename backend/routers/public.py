from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload, joinedload

from database import get_db
from models import User, UserTalent, Team, Organization, Talent, TalentTranslation
from schemas import (
    PublicProfileResponse, 
    PublicTalentItem,
    PublicPresentationResponse,
    PublicPresentationMember,
    PublicPresentationTalent,
    TalentResponse,
    TalentTranslationResponse
)
from rate_limiter import public_rate_limiter
from services.coach_signature import build_coach_signature, build_presentation_signature

import sqlalchemy as sa

router = APIRouter(dependencies=[Depends(public_rate_limiter)])

# Source of truth — mirrors frontend/data/gallupTalents.ts
_NAMES_PL: dict[str, str] = {
    "achiever": "Osiąganie",
    "arranger": "Organizator",
    "belief": "Pryncypialność",
    "consistency": "Bezstronność",
    "deliberative": "Rozwaga",
    "discipline": "Dyscyplina",
    "focus": "Ukierunkowanie",
    "responsibility": "Odpowiedzialność",
    "restorative": "Naprawianie",
    "activator": "Aktywator",
    "command": "Dowodzenie",
    "communication": "Komunikatywność",
    "competition": "Rywalizacja",
    "maximizer": "Maksymalista",
    "self-assurance": "Wiara w siebie",
    "significance": "Poważanie",
    "woo": "Czar",
    "adaptability": "Elastyczność",
    "connectedness": "Współzależność",
    "developer": "Rozwijanie innych",
    "empathy": "Empatia",
    "harmony": "Zgodność",
    "includer": "Integrator",
    "individualization": "Indywidualizacja",
    "positivity": "Optymista",
    "relator": "Bliskość",
    "analytical": "Analityk",
    "context": "Kontekst",
    "futuristic": "Wizjoner",
    "ideation": "Odkrywczość",
    "input": "Zbieranie",
    "intellection": "Intelekt",
    "learner": "Uczenie się",
    "strategic": "Strateg",
}

_DEFAULT_SETTINGS = {
    "show_photo": True,
    "show_talents": True,
    "show_superpowers": True,
    "show_motivators": True,
    "show_blockers": False,
    "show_feedback_style": True,
    "show_certification": True,
}


@router.get("/{slug_or_token}", response_model=PublicProfileResponse)
def get_public_profile(slug_or_token: str, db: Session = Depends(get_db)):
    """
    Fetch a user's public business card by custom slug or fallback public_token.
    Returns only fields the owner has enabled in their privacy settings.
    """
    # Try custom slug first, then fall back to random token
    user = (
        db.query(User)
        .filter(User.public_slug == slug_or_token.lower(), sa.or_(User.is_active == True, User.is_ghost == True))
        .first()
    )
    if not user:
        user = db.query(User).filter(User.public_token == slug_or_token, sa.or_(User.is_active == True, User.is_ghost == True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    s = user.public_profile_settings or _DEFAULT_SETTINGS

    # Build talents list if enabled
    talents = None
    if s.get("show_talents", True):
        talents_count = s.get("talents_count", 5)
        user_talents = (
            db.query(UserTalent)
            .filter(UserTalent.user_id == user.id)
            .order_by(UserTalent.rank)
            .limit(talents_count)
            .all()
        )
        talents = []
        for ut in user_talents:
            t = ut.talent
            # Use static frontend-aligned map first, fall back to DB translation
            pl_name = _NAMES_PL.get(t.code) or next(
                (tr.name for tr in t.translations if tr.language == "pl"),
                t.code,
            )
            en_name = next(
                (tr.name for tr in t.translations if tr.language == "en"),
                None,
            )
            talents.append(PublicTalentItem(
                rank=ut.rank,
                code=t.code,
                name_pl=pl_name,
                name_en=en_name,
                domain=t.domain.value,
            ))

    return PublicProfileResponse(
        full_name=user.full_name,
        job_title=user.job_title,
        job_title_en=user.job_title_en,
        email=user.email if s.get("show_email", True) else None,
        phone=user.phone if s.get("show_phone", True) else None,
        avatar_url=user.avatar_url if s.get("show_photo", True) else None,
        linkedin_url=user.linkedin_url,
        talents=talents,
        superpowers=user.superpowers if s.get("show_superpowers", True) else None,
        motivators=user.motivators if s.get("show_motivators", True) else None,
        blockers=user.blockers if s.get("show_blockers", False) else None,
        feedback_style=user.feedback_style if s.get("show_feedback_style", True) else None,
        superpowers_en=user.superpowers_en if s.get("show_superpowers", True) else None,
        motivators_en=user.motivators_en if s.get("show_motivators", True) else None,
        blockers_en=user.blockers_en if s.get("show_blockers", False) else None,
        feedback_style_en=user.feedback_style_en if s.get("show_feedback_style", True) else None,
        gallup_certified=user.gallup_certified if s.get("show_certification", True) else False,
        gallup_profile_url=user.gallup_profile_url if s.get("show_certification", True) else None,
        prepared_by=build_coach_signature(db, user.organization, subject_user_id=user.id),
    )


@router.get("/presentations/{token}", response_model=PublicPresentationResponse)
def get_presentation(
    token: str,
    lang: str = "pl",
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Fetch team presentation data using a public token (zero PII, rate-limited, optimized query)."""
    if lang not in {"pl", "en"}:
        lang = "pl"

    # Eager load organization, members, user_talents, and talents to prevent N+1 queries
    team = (
        db.query(Team)
        .options(
            joinedload(Team.organization),
            selectinload(Team.members)
            .selectinload(User.user_talents)
            .joinedload(UserTalent.talent),
        )
        .filter(Team.presentation_token == token)
        .first()
    )
    if not team or not team.presentation_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    if response is not None:
        response.headers["X-Robots-Tag"] = "noindex, nofollow"

    # Members with talents. Ghost profiles (people a coach added from a PDF,
    # without an account) count too — same rule as get_public_profile above.
    # Deactivated real accounts (is_active=False, is_ghost=False) stay hidden.
    active_members = [
        m for m in team.members
        if (m.is_active or m.is_ghost) and len(m.user_talents) > 0
    ]
    # Sort strictly by member.id ascending to avoid leaking identity via alphabetical ordering
    active_members.sort(key=lambda m: m.id)

    is_anonymized = team.presentation_anonymized
    org_name = None if is_anonymized else (team.organization.name if team.organization else None)
    person_prefix = "Person" if lang == "en" else "Osoba"

    presentation_members = []
    for idx, member in enumerate(active_members, start=1):
        display_name = f"{person_prefix} {idx}" if is_anonymized else member.full_name
        is_leader = (team.manager_id == member.id)

        results = []
        for ut in sorted(member.user_talents, key=lambda x: x.rank):
            t = ut.talent
            if t:
                results.append(PublicPresentationTalent(
                    rank=ut.rank,
                    talent=t.code,
                    domain=t.domain.value if hasattr(t.domain, "value") else str(t.domain),
                ))

        presentation_members.append(PublicPresentationMember(
            display_name=display_name,
            is_leader=is_leader,
            results=results,
        ))

    # Fetch all 34 talents in one query
    all_talents = db.query(Talent).order_by(Talent.domain, Talent.code).all()
    talent_ids = [t.id for t in all_talents]
    fallback_lang = "en" if lang != "en" else "pl"

    # Batch fetch translations for requested lang + fallback lang in a single query (no N+1)
    translations = (
        db.query(TalentTranslation)
        .filter(
            TalentTranslation.talent_id.in_(talent_ids),
            TalentTranslation.language.in_([lang, fallback_lang]),
        )
        .all()
    )
    # Map talent_id -> best matching translation
    translation_map: dict[int, TalentTranslation] = {}
    for tr in translations:
        if tr.talent_id not in translation_map or tr.language == lang:
            translation_map[tr.talent_id] = tr

    talents_response = []
    for t in all_talents:
        tr = translation_map.get(t.id)
        if tr:
            t_trans = TalentTranslationResponse.model_validate(tr)
        else:
            # Safe fallback: never silently drop a talent column from matrix
            t_trans = TalentTranslationResponse(
                language=lang,
                name=t.code.replace("_", " ").title(),
                description=None,
                short_description=None,
            )
        talents_response.append(TalentResponse(
            id=t.id,
            code=t.code,
            domain=t.domain,
            translation=t_trans,
        ))

    return PublicPresentationResponse(
        team_name=team.name,
        organization_name=org_name,
        anonymized=is_anonymized,
        show_risks=team.presentation_show_risks,
        members=presentation_members,
        talents=talents_response,
        prepared_by=build_presentation_signature(db, team.organization),
    )
