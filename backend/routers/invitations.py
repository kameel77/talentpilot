"""Invitations router for ghost user onboarding."""
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import hash_password, require_role, create_access_token
from database import get_db
from models import (
    InvitationStatus,
    Team,
    TeamInvitation,
    Talent,
    User,
    UserRole,
    UserTalent,
)
from schemas import (
    GhostInviteCreate,
    GhostInviteResponse,
    GhostInviteTalent,
    InvitationAcceptRequest,
    Token,
)

router = APIRouter()

INVITE_TTL_DAYS = 7


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _validate_talents(talents: List[GhostInviteTalent], db: Session) -> None:
    if len(talents) < 1 or len(talents) > 34:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must assign between 1 and 34 talents",
        )
    # Ranks must be unique positive integers
    ranks = [t.rank for t in talents]
    if len(set(ranks)) != len(ranks):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Talent ranks must be unique",
        )
    if any(r < 1 or r > 34 for r in ranks):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Talent ranks must be between 1 and 34",
        )
    talent_ids = [t.talent_id for t in talents]
    existing = db.query(Talent).filter(Talent.id.in_(talent_ids)).all()
    if len(existing) != len(talents):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more talent IDs are invalid",
        )


def _assign_talents(
    db: Session,
    user_id: int,
    talents: List[GhostInviteTalent],
) -> None:
    db.query(UserTalent).filter(UserTalent.user_id == user_id).delete()
    for talent_data in talents:
        db.add(
            UserTalent(
                user_id=user_id,
                talent_id=talent_data.talent_id,
                rank=talent_data.rank,
            )
        )


@router.post("/ghost", response_model=GhostInviteResponse, status_code=status.HTTP_201_CREATED)
def create_ghost_invite(
    data: GhostInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"])),
):
    team = db.query(Team).filter(Team.id == data.team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    if team.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team",
        )

    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user and existing_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User belongs to a different organization",
        )

    if existing_user:
        user = existing_user
    else:
        random_password = secrets.token_urlsafe(24)
        user = User(
            email=data.email,
            hashed_password=hash_password(random_password),
            full_name=data.full_name,
            job_title=data.job_title,
            role=UserRole.USER,
            is_active=False,
            is_ghost=True,
            organization_id=current_user.organization_id,
        )
        db.add(user)
        db.flush()

    if user not in team.members:
        team.members.append(user)

    if data.talents:
        _validate_talents(data.talents, db)
        _assign_talents(db, user.id, data.talents)

    db.query(TeamInvitation).filter(
        TeamInvitation.user_id == user.id,
        TeamInvitation.team_id == team.id,
        TeamInvitation.status == InvitationStatus.ACTIVE,
    ).update(
        {
            TeamInvitation.status: InvitationStatus.REVOKED,
            TeamInvitation.revoked_at: datetime.now(timezone.utc),
        }
    )

    invite_token = secrets.token_urlsafe(32)
    invitation = TeamInvitation(
        user_id=user.id,
        team_id=team.id,
        token_hash=_hash_token(invite_token),
        status=InvitationStatus.ACTIVE,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
        created_by=current_user.id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return GhostInviteResponse(
        invitation_id=invitation.id,
        user_id=user.id,
        invite_token=invite_token,
        expires_at=invitation.expires_at,
        status=invitation.status.value,
    )


@router.post("/accept", response_model=Token, status_code=status.HTTP_200_OK)
def accept_invitation(
    data: InvitationAcceptRequest,
    db: Session = Depends(get_db),
):
    """Accept an invitation and activate the user account.

    - Verifies token and expiry
    - Sets password, activates user (is_active=True, is_ghost=False)
    - Returns JWT for auto-login
    """
    token_hash = _hash_token(data.token)

    invitation = (
        db.query(TeamInvitation)
        .filter(
            TeamInvitation.token_hash == token_hash,
            TeamInvitation.status == InvitationStatus.ACTIVE,
        )
        .first()
    )

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation link.",
        )

    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired.",
        )

    user = db.query(User).filter(User.id == invitation.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Activate user
    user.hashed_password = hash_password(data.password)
    user.is_active = True
    user.is_ghost = False

    # Mark invitation as consumed
    invitation.status = InvitationStatus.REVOKED
    invitation.revoked_at = datetime.now(timezone.utc)

    db.commit()

    # Return JWT for auto-login
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token)
