"""Plan limit enforcement for the billing domain (Phase 1).

See docs/BRIEF_BILLING_TRIAL.md §8. This module is the single place that
knows about plan limits — routers call `assert_within_limit` and nowhere
else re-implements the counting logic.

Billing lives on the coach's own workspace Organization (`is_workspace=True`,
see §4), never on a client organization. Every call to `assert_within_limit`
must pass that billing organization — the one carrying `plan` /
`subscription_status` / `trial_ends_at` — even though the resource being
counted (a client org, a profile) may live elsewhere.

Enforcement is write-only (§8: "nie limitować odczytu"): call this only from
the write paths listed in the brief, never from a GET/list endpoint.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import Organization, OrganizationAccess, PlanTier, User, UserRole
from services.billing.trial import is_trial_active

# Free is what a coach lands on when the trial runs out: client
# organizations are a paid capability outright, individual clients are
# capped at three so the product stays usable (and demoable) without a
# card. See docs/BRIEF_BILLING_TRIAL.md §8.
PLAN_LIMITS = {
    PlanTier.FREE: {"client_orgs": 0, "profiles": 3},
    PlanTier.PRO: {"client_orgs": None, "profiles": None},
    PlanTier.STUDIO: {"client_orgs": None, "profiles": None},
}


def _owning_coach(db: Session, organization: Organization) -> User | None:
    """The coach whose personal workspace `organization` is.

    Today's architecture (see backend/routers/auth.py `register_coach`)
    creates exactly one coach per personal workspace organization, so this
    lookup is unambiguous in practice.
    """
    return (
        db.query(User)
        .filter(User.organization_id == organization.id, User.role == UserRole.COACH)
        .first()
    )


def _count_client_orgs(db: Session, coach: User) -> int:
    """Client orgs = organizations the coach has been granted access to via
    OrganizationAccess, excluding their own workspace (is_workspace=True).

    Mirrors backend/routers/dashboard.py::get_coach_dashboard_overview
    (client_orgs query, ~line 137-147) — do not diverge from that definition.
    """
    return (
        db.query(OrganizationAccess)
        .join(Organization, Organization.id == OrganizationAccess.organization_id)
        .filter(
            OrganizationAccess.user_id == coach.id,
            Organization.is_workspace.is_(False),
        )
        .count()
    )


def _count_profiles(db: Session, coach: User) -> int:
    """Profiles = every user (ghost or activated) the coach is responsible
    for, excluding the coach's own account.

    This is the coach's own workspace (their "individual clients" —
    users living directly in the coach's personal org) PLUS every user in
    every client organization the coach has access to. It mirrors the
    `totals.people` calculation in
    backend/routers/dashboard.py::get_coach_dashboard_overview
    (individual_clients + sum of client org members).
    """
    org_ids: set[int] = set()
    if coach.organization_id is not None:
        org_ids.add(coach.organization_id)

    access_org_ids = [
        org_id
        for (org_id,) in db.query(OrganizationAccess.organization_id)
        .filter(OrganizationAccess.user_id == coach.id)
        .all()
    ]
    org_ids.update(access_org_ids)

    if not org_ids:
        return 0

    return (
        db.query(User)
        .filter(User.organization_id.in_(org_ids), User.id != coach.id)
        .count()
    )


_COUNTERS = {
    "client_orgs": _count_client_orgs,
    "profiles": _count_profiles,
}


def check_within_limit(db: Session, organization: Organization, resource: str, count: int = 1) -> dict:
    """Check if `organization`'s owning coach is within plan limit for `resource` when requesting `count` items.
    
    Returns a dict with `allowed: bool` and metadata (limit, current, remaining, requested, plan, code).
    Does not raise HTTPException.
    """
    if resource not in _COUNTERS:
        raise ValueError(f"Unknown plan-limited resource: {resource!r}")

    if is_trial_active(organization):
        return {"allowed": True, "resource": resource, "limit": None, "current": 0, "remaining": None, "requested": count}

    limit = PLAN_LIMITS.get(organization.plan, {}).get(resource)
    if limit is None:
        return {"allowed": True, "resource": resource, "limit": None, "current": 0, "remaining": None, "requested": count}

    coach = _owning_coach(db, organization)
    if coach is None:
        return {"allowed": True, "resource": resource, "limit": limit, "current": 0, "remaining": limit, "requested": count}

    current = _COUNTERS[resource](db, coach)
    remaining = max(0, limit - current)
    if current + count > limit:
        return {
            "allowed": False,
            "code": "plan_limit_exceeded",
            "resource": resource,
            "limit": limit,
            "current": current,
            "remaining": remaining,
            "requested": count,
            "plan": organization.plan.value if organization.plan else "free",
        }
    return {
        "allowed": True,
        "resource": resource,
        "limit": limit,
        "current": current,
        "remaining": remaining,
        "requested": count,
    }


def assert_within_limit(db: Session, organization: Organization, resource: str, count: int = 1) -> None:
    """Raise HTTP 402 if `organization`'s owning coach exceeds plan limit for `resource` when adding `count` items.

    `organization` must be the *billing* organization (the coach's own
    workspace) — never a client organization. Pass `resource` as either
    "client_orgs" or "profiles".
    """
    check = check_within_limit(db, organization, resource, count=count)
    if not check["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "plan_limit_exceeded",
                "resource": check["resource"],
                "limit": check["limit"],
                "current": check["current"],
            },
        )
