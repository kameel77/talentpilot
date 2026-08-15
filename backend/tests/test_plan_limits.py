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


def _end_trial(db_session, coach_id):
    """Drop a freshly registered coach onto Free.

    Registration grants a product-led trial (docs §3), which is unlimited
    — every Free-limit assertion below has to get past it first. Mirrors
    what the SUBSCRIPTION_DELETED webhook does when a trial lapses.
    """
    org = _get_coach_org(db_session, coach_id)
    org.plan = PlanTier.FREE
    org.subscription_status = SubscriptionStatus.FREE
    org.trial_ends_at = None
    db_session.commit()
    return org


# ---------------------------------------------------------------------------
# client_orgs limit
# ---------------------------------------------------------------------------

def test_free_org_cannot_create_any_client_org(client, db_session):
    """Client organizations are a paid capability outright on Free."""
    headers, coach_id = _register_coach(client, db_session)
    _end_trial(db_session, coach_id)

    response = _create_client_org(client, headers, "Acme")
    assert response.status_code == 402, response.text
    assert response.json()["detail"] == {
        "code": "plan_limit_exceeded",
        "resource": "client_orgs",
        "limit": 0,
        "current": 0,
    }


def test_trial_granted_at_registration_allows_client_orgs(client, db_session):
    """The trial from registration is unlimited — no card, no 402."""
    headers, coach_id = _register_coach(client, db_session)
    org = _get_coach_org(db_session, coach_id)
    assert org.subscription_status == SubscriptionStatus.TRIALING
    assert org.trial_ends_at is not None

    for name in ("Acme", "Beta"):
        response = _create_client_org(client, headers, name)
        assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# profiles limit
# ---------------------------------------------------------------------------

def test_free_org_at_profiles_limit_returns_402(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    for i in range(3):
        response = _create_ghost(client, headers, org_id, f"Member {i}")
        assert response.status_code == 201, response.text

    fourth = _create_ghost(client, headers, org_id, "Member 3")
    assert fourth.status_code == 402, fourth.text
    assert fourth.json()["detail"] == {
        "code": "plan_limit_exceeded",
        "resource": "profiles",
        "limit": 3,
        "current": 3,
    }


def test_bulk_import_at_boundary_leaves_no_partial_state(client, db_session):
    """3 sequential creates succeed, the 4th 402s, and the DB ends up with
    exactly 3 profiles — no partially written state from the failed 4th call.
    """
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    for i in range(3):
        response = _create_ghost(client, headers, org_id, f"Import {i}")
        assert response.status_code == 201, response.text

    fourth = _create_ghost(client, headers, org_id, "Import 3")
    assert fourth.status_code == 402, fourth.text

    db_session.expire_all()
    profile_count = (
        db_session.query(User)
        .filter(User.organization_id == org_id, User.id != coach_id)
        .count()
    )
    assert profile_count == 3


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
    """An expired trial nobody downgraded yet must not stay unlimited."""
    headers, coach_id = _register_coach(client, db_session)
    org = _get_coach_org(db_session, coach_id)
    org.subscription_status = SubscriptionStatus.TRIALING
    org.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    response = _create_client_org(client, headers, "Acme")
    assert response.status_code == 402, response.text


# ---------------------------------------------------------------------------
# Reads are never limited
# ---------------------------------------------------------------------------

def test_reads_still_work_for_over_limit_org(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    for i in range(3):
        assert _create_ghost(client, headers, org_id, f"Member {i}").status_code == 201
    assert _create_ghost(client, headers, org_id, "Member 3").status_code == 402

    users_response = client.get("/api/users", headers=headers)
    assert users_response.status_code == 200
    assert len(users_response.json()) == 4  # 3 ghosts + the coach

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


# ---------------------------------------------------------------------------
# GET /api/billing/check-limit & parse-pdf intent guard
# ---------------------------------------------------------------------------

def test_check_limit_endpoint_profiles_and_client_orgs(client, db_session):
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    # Free coach starts with 0 profiles (the coach themselves does not count against the 3 ghost profiles limit)
    res = client.get("/api/billing/check-limit?resource=profiles", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["allowed"] is True
    assert data["resource"] == "profiles"
    assert data["limit"] == 3
    assert data["current"] == 0

    # Add 3 members to reach the limit
    for i in range(3):
        assert _create_ghost(client, headers, org_id, f"Member {i}").status_code == 201

    # Now profiles limit is reached
    res = client.get("/api/billing/check-limit?resource=profiles", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["allowed"] is False
    assert data["code"] == "plan_limit_exceeded"
    assert data["current"] == 3

    # Client orgs is 0 on Free plan
    res = client.get("/api/billing/check-limit?resource=client_orgs", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["allowed"] is False
    assert data["limit"] == 0


from unittest.mock import patch
from services.gallup_pdf_parser import GallupPersonInfo

@patch("routers.gallup.extract_gallup_rankings")
def test_parse_pdf_intent_guard_only_blocks_new_profile(mock_extract, client, db_session):
    mock_extract.return_value = ({"achiever": 1}, 5, GallupPersonInfo())
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    # Fill 3 profiles to hit limit
    for i in range(3):
        assert _create_ghost(client, headers, org_id, f"Member {i}").status_code == 201

    pdf_content = b"%PDF-1.4 test content"

    # intent=new_profile should be blocked with 402
    res_new = client.post(
        "/api/gallup/parse-pdf?intent=new_profile",
        files={"file": ("test.pdf", pdf_content, "application/pdf")},
        headers=headers,
    )
    assert res_new.status_code == 402, res_new.text
    assert res_new.json()["detail"]["code"] == "plan_limit_exceeded"

    # intent=existing (updating existing member / own talents) must be allowed
    res_existing = client.post(
        "/api/gallup/parse-pdf?intent=existing",
        files={"file": ("test.pdf", pdf_content, "application/pdf")},
        headers=headers,
    )
    assert res_existing.status_code == 200, res_existing.text
    assert res_existing.json()["rankings"]["achiever"] == 1

    # Default (no query param) defaults to existing -> allowed
    res_default = client.post(
        "/api/gallup/parse-pdf",
        files={"file": ("test.pdf", pdf_content, "application/pdf")},
        headers=headers,
    )
    assert res_default.status_code == 200, res_default.text


def test_check_limit_with_batch_count(client, db_session):
    """Test batch pre-check: a coach with 2/3 profiles can add 1, but not 2 or 5."""
    headers, coach_id = _register_coach(client, db_session)
    coach = db_session.query(User).filter(User.id == coach_id).first()
    org_id = coach.organization_id
    _end_trial(db_session, coach_id)

    # Add 2 members (current = 2 / 3)
    for i in range(2):
        assert _create_ghost(client, headers, org_id, f"Member {i}").status_code == 201

    # count=1 is within remaining limit (2 + 1 = 3 <= 3)
    res_1 = client.get("/api/billing/check-limit?resource=profiles&count=1", headers=headers)
    assert res_1.status_code == 200
    data_1 = res_1.json()
    assert data_1["allowed"] is True
    assert data_1["current"] == 2
    assert data_1["remaining"] == 1
    assert data_1["requested"] == 1

    # count=2 exceeds limit (2 + 2 = 4 > 3)
    res_2 = client.get("/api/billing/check-limit?resource=profiles&count=2", headers=headers)
    assert res_2.status_code == 200
    data_2 = res_2.json()
    assert data_2["allowed"] is False
    assert data_2["code"] == "plan_limit_exceeded"
    assert data_2["current"] == 2
    assert data_2["remaining"] == 1
    assert data_2["requested"] == 2

    # count=5 (uploading 5 PDFs when only 1 spot left) is immediately rejected
    res_5 = client.get("/api/billing/check-limit?resource=profiles&count=5", headers=headers)
    assert res_5.status_code == 200
    data_5 = res_5.json()
    assert data_5["allowed"] is False
    assert data_5["remaining"] == 1
    assert data_5["requested"] == 5
