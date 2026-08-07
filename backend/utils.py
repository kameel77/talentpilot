"""Utility functions and shared constants for TalentPilot backend."""
from typing import Optional
from datetime import datetime, timezone, timedelta

PLACEHOLDER_EMAIL_DOMAIN = "placeholder.talentpilot.local"
INVITE_TTL_DAYS = 7


def is_placeholder_email(email: Optional[str]) -> bool:
    """Check if an email address is a synthetic placeholder domain."""
    if not email:
        return False
    parts = email.split("@")
    if len(parts) == 2:
        domain = parts[1].lower()
        return domain == PLACEHOLDER_EMAIL_DOMAIN or domain.endswith(f".{PLACEHOLDER_EMAIL_DOMAIN}")
    return False


def compute_invitation_status(user) -> str:
    """Compute invitation status string for a user."""
    if user.is_active:
        return "active"
    if user.invited_at is None:
        return "not_invited"
    invited = user.invited_at
    if invited.tzinfo is None:
        invited = invited.replace(tzinfo=timezone.utc)
    if invited < datetime.now(timezone.utc) - timedelta(days=INVITE_TTL_DAYS):
        return "expired"
    return "invited"
