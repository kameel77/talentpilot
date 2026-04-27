"""Public profile endpoints — no authentication required."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserTalent, Team, Organization
from schemas import (
    PublicProfileResponse, 
    PublicTalentItem,
    PublicTeamPresentationResponse,
    PresentationMember,
    PresentationTalentResult,
    PresentationOrg
)

router = APIRouter()

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
        .filter(User.public_slug == slug_or_token.lower(), User.is_active == True)
        .first()
    )
    if not user:
        user = db.query(User).filter(User.public_token == slug_or_token, User.is_active == True).first()
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
    )


@router.get("/presentations/{token}", response_model=PublicTeamPresentationResponse)
def get_presentation(token: str, db: Session = Depends(get_db)):
    """Fetch team presentation data using a public token."""
    team = db.query(Team).filter(Team.presentation_token == token).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    organization = db.query(Organization).filter(Organization.id == team.organization_id).first()
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
    user_ids = [m.user_id for m in members]
    
    users = db.query(User).filter(User.id.in_(user_ids), User.is_active == True).all()
    user_map = {u.id: u for u in users}

    # Fetch talents for all these users
    user_talents = db.query(UserTalent).filter(UserTalent.user_id.in_(user_ids)).all()
    talent_map = {}
    for ut in user_talents:
        if ut.user_id not in talent_map:
            talent_map[ut.user_id] = []
        talent_map[ut.user_id].append(ut)

    presentation_members = []
    for member in members:
        user = user_map.get(member.user_id)
        if not user:
            continue
            
        results = []
        uts = talent_map.get(user.id, [])
        for ut in uts:
            t = ut.talent
            results.append(PresentationTalentResult(
                id=str(ut.id),
                rank=ut.rank,
                talent=t.code,
                domain=t.domain.value
            ))
            
        presentation_members.append(PresentationMember(
            id=str(user.id),
            name=user.full_name,
            email=user.email,
            role=member.role or user.job_title,
            results=results
        ))

    return PublicTeamPresentationResponse(
        id=str(team.id),
        name=team.name,
        organization=PresentationOrg(id=str(organization.id), name=organization.name),
        members=presentation_members
    )
