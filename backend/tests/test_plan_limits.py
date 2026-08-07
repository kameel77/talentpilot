"""Tests for backend/services/plan_limits.py and its enforcement points.

Covers docs/BRIEF_BILLING_TRIAL.md §8 DoD items 2, 3, 6 for Phase 1
(provider-agnostic domain — no Stripe involved).
"""
from datetime import datetime, timedelta, timezone

from models import Organization, PlanTier, SubscriptionStatus, User


def _register_coach(client, db_session, email="coach@example.com", full_name="Anna Kowalska"):
    """Register a coach via the self-serve endpoint, return (headers, coach_id)."""
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    coach = db_session.query(User).filter(User.email == email).first()
    return {"Authorization": f"Bearer {data['access_token']}"}, coach.id


def _create_client_org(client, headers, name):
    return client.post("/api/organizations", json={"name": name}, headers=headers)


def _create_ghost(client, headers, organization_id, full_name):
    return client.post(
        "/api/invitations/ghost",
        json={"full_name": full_name, "organization_id": organization_id},
        headers=headers,
    )


def _get_coach_org(db_session, coach_id):
    coach = db_session.query(User).filter(User.id == coach_id).first()
    return db_session.query(Organization).filter(Organization.id == coach.organization_id).first()


# ---------------------------------------------------------------------------
# client_orgs limit
# ---------------------------------------------------------------------------

def test_free_org_at_client_orgs_limit_returns_402(client, db_session):
    headers, _ = _register_coach(client, db_session)

    first = _create_client_org(client, headers, "Acme")
    assert first.status_code == 201, first.text

    second = _create_client_org(client, headers, "Beta")
    assert second.status_code == 402, second.text
    assert second.json()["detail"] == {
        "code": "plan_limit_exceeded",
        "resource": "client_orgs",
        "limit": 1,
        "current": 1,
    }


def test_free_org_under_client_orgs_limit_succeeds(client, db_session):
    headers, _ = _register_coach(client, db_session)
    response = _create_client_org(client, headers, "Acme")
    assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# profiles limit
# ---------------------------------------------------------------------------

def test_free_org_at_profiles_limit_returns_402(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id

    for i in range(5):
        response = _create_ghost(client, headers, org_id, f"Member {i}")
        assert response.status_code == 201, response.text

    sixth = _create_ghost(client, headers, org_id, "Member 5")
    assert sixth.status_code == 402, sixth.text
    assert sixth.json()["detail"] == {
        "code": "plan_limit_exceeded",
        "resource": "profiles",
        "limit": 5,
        "current": 5,
    }


def test_bulk_import_at_boundary_leaves_no_partial_state(client, db_session):
    """5 sequential creates succeed, the 6th 402s, and the DB ends up with
    exactly 5 profiles — no partially written state from the failed 6th call.
    """
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id

    for i in range(5):
        response = _create_ghost(client, headers, org_id, f"Import {i}")
        assert response.status_code == 201, response.text

    sixth = _create_ghost(client, headers, org_id, "Import 5")
    assert sixth.status_code == 402, sixth.text

    db_session.expire_all()
    profile_count = (
        db_session.query(User)
        .filter(User.organization_id == org_id, User.id != coach_id)
        .count()
    )
    assert profile_count == 5


# ---------------------------------------------------------------------------
# PRO plan — unlimited
# ---------------------------------------------------------------------------

def test_pro_org_raises_no_limit_for_either_resource(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    org = _get_coach_org(db_session, coach_id)
    org.plan = PlanTier.PRO
    db_session.commit()

    for i in range(3):
        response = _create_client_org(client, headers, f"Client {i}")
        assert response.status_code == 201, response.text

    for i in range(7):
        response = _create_ghost(client, headers, org.id, f"Profile {i}")
        assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Trialing
# ---------------------------------------------------------------------------

def test_trialing_org_with_future_trial_end_is_unlimited(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    org = _get_coach_org(db_session, coach_id)
    org.subscription_status = SubscriptionStatus.TRIALING
    org.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=30)
    db_session.commit()

    first = _create_client_org(client, headers, "Acme")
    assert first.status_code == 201, first.text
    second = _create_client_org(client, headers, "Beta")
    assert second.status_code == 201, second.text


def test_trialing_org_with_past_trial_end_falls_back_to_plan_limit(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    org = _get_coach_org(db_session, coach_id)
    org.subscription_status = SubscriptionStatus.TRIALING
    org.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    first = _create_client_org(client, headers, "Acme")
    assert first.status_code == 201, first.text
    second = _create_client_org(client, headers, "Beta")
    assert second.status_code == 402, second.text


# ---------------------------------------------------------------------------
# Reads are never limited
# ---------------------------------------------------------------------------

def test_reads_still_work_for_over_limit_org(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id

    for i in range(5):
        assert _create_ghost(client, headers, org_id, f"Member {i}").status_code == 201
    assert _create_ghost(client, headers, org_id, "Member 5").status_code == 402

    users_response = client.get("/api/users", headers=headers)
    assert users_response.status_code == 200
    assert len(users_response.json()) == 6  # 5 ghosts + the coach

    orgs_response = client.get("/api/organizations", headers=headers)
    assert orgs_response.status_code == 200


# ---------------------------------------------------------------------------
# Admin override
# ---------------------------------------------------------------------------

def test_admin_override_sets_trial_ends_at_and_is_not_clobbered(client, db_session, auth_headers_admin):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id

    trial_ends_at = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    response = client.patch(
        f"/api/admin/organizations/{org_id}/billing",
        json={"trial_ends_at": trial_ends_at},
        headers=auth_headers_admin,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["subscription_status"] == "trialing"
    assert data["trial_ends_at"] is not None

    # An unrelated update to the organization must not clobber the override.
    rename = client.patch(
        f"/api/organizations/{org_id}",
        json={"name": "Renamed Workspace"},
        headers=headers,
    )
    assert rename.status_code == 200, rename.text

    db_session.expire_all()
    org = db_session.query(Organization).filter(Organization.id == org_id).first()
    assert org.trial_ends_at is not None
    assert org.subscription_status == SubscriptionStatus.TRIALING


def test_admin_override_requires_admin_role(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()

    response = client.patch(
        f"/api/admin/organizations/{coach.organization_id}/billing",
        json={"plan": "pro"},
        headers=headers,
    )
    assert response.status_code == 403
