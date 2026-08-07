"""Seed three billing-state fixtures for manual QA / demos.

docs/BRIEF_BILLING_TRIAL.md — creates:
  1. A coach on an active 14-day trial.
  2. A coach on Free, at the plan limit (1 client org, 5 profiles).
  3. A coach whose subscription is PAST_DUE.

Idempotent — safe to re-run; existing rows are updated in place rather than
duplicated. Refuses to run when ENVIRONMENT=production: these are synthetic
accounts with a shared, known password, never appropriate outside dev/CI.

This writes Organization/User columns directly rather than going through
`services/billing/webhook_handler.apply_webhook` — unlike
`backend/routers/dev_billing.py`, this is offline fixture setup, not a
simulation of provider behavior, so there's no webhook-shaped event to
route through. It's the same pattern `routers/admin.py`'s billing override
endpoint already uses for design-partner trials.
"""
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings
from database import SessionLocal
from models import Organization, OrganizationAccess, PlanTier, SubscriptionStatus, User, UserRole
from auth import hash_password

SEED_PASSWORD = "seedpass123"


def _get_or_create_coach(db, email: str, full_name: str):
    coach = db.query(User).filter(User.email == email).first()
    if coach is not None:
        org = db.query(Organization).filter(Organization.id == coach.organization_id).first()
        return coach, org

    org = Organization(name=f"{full_name} — Coaching", is_workspace=True, name_confirmed=True)
    db.add(org)
    db.flush()

    coach = User(
        email=email,
        hashed_password=hash_password(SEED_PASSWORD),
        full_name=full_name,
        role=UserRole.COACH,
        organization_id=org.id,
        is_active=True,
    )
    db.add(coach)
    db.flush()
    return coach, org


def _ensure_ghost_profiles(db, org: Organization, coach: User, count: int) -> None:
    existing = db.query(User).filter(User.organization_id == org.id, User.id != coach.id).count()
    for i in range(existing, count):
        ghost = User(
            email=f"ghost-{org.id}-{i}@seed.talentpilot.local",
            hashed_password=hash_password(SEED_PASSWORD),
            full_name=f"Seed Profile {i + 1}",
            role=UserRole.USER,
            organization_id=org.id,
            is_active=False,
            is_ghost=True,
        )
        db.add(ghost)


def _ensure_client_org(db, coach: User, name: str) -> Organization:
    existing = (
        db.query(Organization)
        .filter(Organization.name == name, Organization.is_workspace.is_(False))
        .first()
    )
    if existing is not None:
        access = (
            db.query(OrganizationAccess)
            .filter(
                OrganizationAccess.user_id == coach.id,
                OrganizationAccess.organization_id == existing.id,
            )
            .first()
        )
        if access is None:
            db.add(OrganizationAccess(user_id=coach.id, organization_id=existing.id))
        return existing

    org = Organization(name=name)
    db.add(org)
    db.flush()
    db.add(OrganizationAccess(user_id=coach.id, organization_id=org.id))
    return org


def seed_billing_states() -> None:
    if settings.environment == "production":
        raise RuntimeError("seed_billing_states must not run with ENVIRONMENT=production")

    db = SessionLocal()
    try:
        # 1. Active trial
        trial_coach, trial_org = _get_or_create_coach(db, "trial@seed.talentpilot.local", "Trial Coach")
        trial_org.plan = PlanTier.FREE
        trial_org.subscription_status = SubscriptionStatus.TRIALING
        trial_org.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=14)
        db.flush()

        # 2. Free, at the plan limit (1 client org, 5 profiles)
        free_coach, free_org = _get_or_create_coach(
            db, "free-at-limit@seed.talentpilot.local", "Free Limit Coach"
        )
        free_org.plan = PlanTier.FREE
        free_org.subscription_status = SubscriptionStatus.FREE
        free_org.trial_ends_at = None
        db.flush()
        _ensure_client_org(db, free_coach, "Free Limit Coach — Client Org")
        _ensure_ghost_profiles(db, free_org, free_coach, count=5)

        # 3. Past due
        past_due_coach, past_due_org = _get_or_create_coach(
            db, "past-due@seed.talentpilot.local", "Past Due Coach"
        )
        past_due_org.plan = PlanTier.PRO
        past_due_org.subscription_status = SubscriptionStatus.PAST_DUE
        past_due_org.billing_customer_id = past_due_org.billing_customer_id or "seed_cus_past_due"
        past_due_org.billing_subscription_id = past_due_org.billing_subscription_id or "seed_sub_past_due"

        db.commit()
        print("Seeded billing states:")
        print(f"  trial:         {trial_coach.email} / {SEED_PASSWORD}")
        print(f"  free-at-limit: {free_coach.email} / {SEED_PASSWORD}")
        print(f"  past-due:      {past_due_coach.email} / {SEED_PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_billing_states()
