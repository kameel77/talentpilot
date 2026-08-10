"""Product-led trial: length, start, and remaining time.

docs/BRIEF_BILLING_TRIAL.md §3. The trial is granted at registration and
requires no card — `services/plan_limits.py` treats a trialing organization
as unlimited until `trial_ends_at` passes, after which the Free limits bite.

Single source of truth for "is this org still in its trial and for how
long", so that plan limits, the Stripe checkout trial and the billing
status endpoint can never disagree with one another.
"""
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from config import settings
from models import Organization, SubscriptionStatus, UserRole


def trial_days_for(role: Optional[UserRole]) -> int:
    """Trial length in days for a workspace owned by `role`."""
    if role == UserRole.COACH:
        return settings.billing_trial_days_coach
    return settings.billing_trial_days_default


def start_trial(organization: Organization, role: Optional[UserRole], now: Optional[datetime] = None) -> None:
    """Put a freshly created workspace into its trial.

    Deliberately does not commit — callers are already inside the
    registration transaction that creates the organization.
    """
    now = now or datetime.now(timezone.utc)
    organization.subscription_status = SubscriptionStatus.TRIALING
    organization.trial_ends_at = now + timedelta(days=trial_days_for(role))


def _as_aware(value: datetime) -> datetime:
    """Columns are timezone-aware, but naive values can slip in via direct
    DB writes or tests — treat those as UTC rather than crashing."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def is_trial_active(organization: Organization, now: Optional[datetime] = None) -> bool:
    """True only while the org is TRIALING *and* `trial_ends_at` is ahead.

    An expired trial whose status was never flipped (no webhook, no cron)
    falls back to the plan's normal limits instead of staying unlimited
    forever.
    """
    if organization.subscription_status != SubscriptionStatus.TRIALING:
        return False
    if organization.trial_ends_at is None:
        return False
    return _as_aware(organization.trial_ends_at) > (now or datetime.now(timezone.utc))


def remaining_trial_days(organization: Organization, now: Optional[datetime] = None) -> int:
    """Whole days left in the trial, 0 when it is over or never started.

    Rounded up: a trial ending in six hours still counts as one day, which
    is both what a customer reads on the banner and what we hand Stripe as
    `trial_period_days` so the two never diverge.
    """
    if not is_trial_active(organization, now):
        return 0
    now = now or datetime.now(timezone.utc)
    delta = _as_aware(organization.trial_ends_at) - now
    return max(0, math.ceil(delta.total_seconds() / 86400))
