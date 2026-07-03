"""External API endpoints for integrations."""

import os
import secrets
import hashlib
import tempfile
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Literal

from schemas import (
    ExternalGallupResponse, ExternalPersonInfo, ExternalTalent, ExternalTalentName, ExternalDomain,
    ExternalProvisionOrgTeamRequest, ExternalProvisionOrgTeamResponse,
    ExternalProvisionUsersRequest, ExternalProvisionUsersResponse, ExternalProvisionUserResult,
)
from services.gallup_pdf_parser import extract_gallup_rankings
from services.email_service import send_invitation_email
from auth import verify_api_key, hash_password
from database import get_db
from models import (
    Talent, TalentTranslation, ApiKey,
    Organization, Team, User, UserRole, UserTalent, TeamInvitation, InvitationStatus,
)

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
        rankings, _, person_info = extract_gallup_rankings(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    person = ExternalPersonInfo(
        first_name=person_info.first_name,
        last_name=person_info.last_name,
    ) if person_info.first_name or person_info.last_name else None

    if not rankings:
        return ExternalGallupResponse(language=language, person=person, talents=[])

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

    return ExternalGallupResponse(language=language, person=person, talents=external_talents)


INVITE_TTL_DAYS = 7


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post(
    "/provision/org-team",
    response_model=ExternalProvisionOrgTeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Get or create organization and team",
    description="""
Used by talentpilot-team to map its local org/team to a TalentPilot org/team.

- If `org_id` is provided, the existing organization is used.
- If not, a new organization is created with `org_name`.
- Same logic applies to `team_id` / `team_name`.

Store the returned `org_id` and `team_id` in talentpilot-team for future calls.
""",
)
def provision_org_team(
    data: ExternalProvisionOrgTeamRequest,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(verify_api_key),
) -> ExternalProvisionOrgTeamResponse:
    org_created = False
    team_created = False

    if data.org_id is not None:
        org = db.query(Organization).filter(Organization.id == data.org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
    else:
        org = Organization(name=data.org_name)
        db.add(org)
        db.flush()
        org_created = True

    if org.is_workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create teams in a private workspace",
        )

    if data.team_id is not None:
        team = db.query(Team).filter(
            Team.id == data.team_id,
            Team.organization_id == org.id,
        ).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found in this organization")
    else:
        team = Team(name=data.team_name, organization_id=org.id)
        db.add(team)
        db.flush()
        team_created = True

    db.commit()
    return ExternalProvisionOrgTeamResponse(
        org_id=org.id,
        team_id=team.id,
        org_created=org_created,
        team_created=team_created,
    )


@router.post(
    "/provision/users",
    response_model=ExternalProvisionUsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Bulk provision users with ghost accounts and invitations",
    description="""
Creates ghost user accounts for the given list and sends invitation emails.

For each user:
1. If the email already exists in the organization — adds to team (if not already a member) and skips creation.
2. If not — creates a ghost account (inactive, no password), assigns talents (all 34 ranks if provided).
3. Creates a 7-day invitation token and sends an activation email.

`talents` array is optional. If provided, all entries are stored (ranks 1–34).
""",
)
def provision_users(
    data: ExternalProvisionUsersRequest,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(verify_api_key),
) -> ExternalProvisionUsersResponse:
    org = db.query(Organization).filter(Organization.id == data.org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    team = db.query(Team).filter(
        Team.id == data.team_id,
        Team.organization_id == org.id,
    ).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found in this organization")

    # Pre-fetch talent codes → IDs
    talent_codes = {
        t.talent_code
        for u in data.users
        if u.talents
        for t in u.talents
    }
    talent_map: dict[str, int] = {}
    if talent_codes:
        rows = db.query(Talent).filter(Talent.code.in_(talent_codes)).all()
        talent_map = {r.code: r.id for r in rows}

    results: list[ExternalProvisionUserResult] = []

    for user_data in data.users:
        try:
            existing = db.query(User).filter(
                User.email == user_data.email,
                User.organization_id == org.id,
            ).first()

            if existing:
                user = existing
                user_status = "existing"
            else:
                random_pw = secrets.token_urlsafe(24)
                user = User(
                    email=user_data.email,
                    hashed_password=hash_password(random_pw),
                    full_name=user_data.full_name,
                    role=UserRole.USER,
                    is_active=False,
                    is_ghost=True,
                    organization_id=org.id,
                )
                db.add(user)
                db.flush()
                user_status = "created"

            # Add to team if not already member
            if user not in team.members:
                team.members.append(user)

            # Assign talents (replace existing)
            if user_data.talents:
                db.query(UserTalent).filter(UserTalent.user_id == user.id).delete()
                for t in user_data.talents:
                    talent_id = talent_map.get(t.talent_code)
                    if talent_id:
                        db.add(UserTalent(user_id=user.id, talent_id=talent_id, rank=t.rank))

            # Revoke previous invitations for this team
            db.query(TeamInvitation).filter(
                TeamInvitation.user_id == user.id,
                TeamInvitation.team_id == team.id,
                TeamInvitation.status == InvitationStatus.ACTIVE,
            ).update({
                TeamInvitation.status: InvitationStatus.REVOKED,
                TeamInvitation.revoked_at: datetime.now(timezone.utc),
            })

            # Create new invitation
            invite_token = secrets.token_urlsafe(32)
            invitation = TeamInvitation(
                user_id=user.id,
                team_id=team.id,
                token_hash=_hash_token(invite_token),
                status=InvitationStatus.ACTIVE,
                expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
            )
            db.add(invitation)
            db.flush()

            db.commit()

            # Send invitation email (non-blocking — errors logged, not raised)
            send_invitation_email(
                to_email=user_data.email,
                full_name=user_data.full_name,
                invite_token=invite_token,
                team_name=team.name,
            )

            results.append(ExternalProvisionUserResult(
                email=user_data.email,
                full_name=user_data.full_name,
                status=user_status,
                user_id=user.id,
            ))

        except Exception as exc:
            db.rollback()
            results.append(ExternalProvisionUserResult(
                email=user_data.email,
                full_name=user_data.full_name,
                status="error",
                error=str(exc),
            ))

    return ExternalProvisionUsersResponse(
        total=len(results),
        created=sum(1 for r in results if r.status == "created"),
        existing=sum(1 for r in results if r.status == "existing"),
        errors=sum(1 for r in results if r.status == "error"),
        results=results,
    )
