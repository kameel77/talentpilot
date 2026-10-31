"""Coach signature on client-facing artefacts (brief #4, B).

A client's public profile (/aboutme) and a team presentation carry a small
"prepared by" footer with the coach's name, certification and contact. Every
link a coach shares then promotes the coach (and TalentPilot).

Privacy rules:
- Only fields the coach exposes on their own public profile are returned
  (`public_profile_settings`: show_photo / show_email / show_phone /
  show_certification), so the signature never reveals more than the coach's
  own business card does.
- The coach can switch the signature off entirely
  (`public_profile_settings.show_coach_signature`, default on).
- Placeholder emails are never exposed.
"""
from typing import Optional

from sqlalchemy.orm import Session

from models import Organization, OrganizationAccess, User, UserRole
from schemas import PublicCoachSignature, PublicPresentationCoach
from utils import is_placeholder_email


def resolve_coach_for_org(db: Session, organization: Optional[Organization]) -> Optional[User]:
    """The coach responsible for an organization's people, if any.

    - Coach workspace (individual clients): its owner coach.
    - Client organization: the earliest-granted active coach with access.
    """
    if organization is None:
        return None
    base = db.query(User).filter(User.role == UserRole.COACH, User.is_active.is_(True))
    if organization.is_workspace:
        return base.filter(User.organization_id == organization.id).order_by(User.id).first()
    return (
        base.join(OrganizationAccess, OrganizationAccess.user_id == User.id)
        .filter(OrganizationAccess.organization_id == organization.id)
        .order_by(OrganizationAccess.id)
        .first()
    )


def build_coach_signature(
    db: Session,
    organization: Optional[Organization],
    subject_user_id: Optional[int] = None,
) -> Optional[PublicCoachSignature]:
    """Signature of the coach behind `organization`, or None when there is no
    coach, the coach disabled it, or the subject is the coach themself."""
    coach = resolve_coach_for_org(db, organization)
    if coach is None or coach.id == subject_user_id:
        return None

    s = coach.public_profile_settings or {}
    if not s.get("show_coach_signature", True):
        return None

    show_certification = s.get("show_certification", True)
    email = coach.email if s.get("show_email", True) and not is_placeholder_email(coach.email) else None
    return PublicCoachSignature(
        full_name=coach.full_name,
        avatar_url=coach.avatar_url if s.get("show_photo", True) else None,
        gallup_certified=bool(coach.gallup_certified) if show_certification else False,
        gallup_profile_url=coach.gallup_profile_url if show_certification else None,
        email=email,
        phone=coach.phone if s.get("show_phone", True) else None,
        linkedin_url=coach.linkedin_url,
        profile_handle=coach.public_slug or coach.public_token,
    )


def build_presentation_signature(
    db: Session, organization: Optional[Organization]
) -> Optional[PublicPresentationCoach]:
    """Reduced signature for team presentations (no contact data, see schema)."""
    full = build_coach_signature(db, organization)
    if full is None:
        return None
    return PublicPresentationCoach(
        full_name=full.full_name,
        gallup_certified=full.gallup_certified,
        profile_handle=full.profile_handle,
    )
