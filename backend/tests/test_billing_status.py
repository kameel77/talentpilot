"""Tests for the product-led trial and GET /api/billing/status.

docs/BRIEF_BILLING_TRIAL.md §3. The trial is granted at registration with
no card, so the status endpoint must answer truthfully even when no
payment provider is configured (`BILLING_PROVIDER=disabled`).
"""
from datetime import datetime, timedelta, timezone

import config
from models import Organization, SubscriptionStatus, User


def _register_coach(client, db_session, email="status-coach@example.com"):
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": "Status Coach"},
    )
    assert response.status_code == 201, response.text
    coach = db_session.query(User).filter(User.email == email).first()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, coach


def _register_admin(client, db_session, email="status-admin@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "full_name": "Status Admin"},
    )
    assert response.status_code == 201, response.text
    user = db_session.query(User).filter(User.email == email).first()
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, user


def _org_for(db_session, user):
    return db_session.query(Organization).filter(Organization.id == user.organization_id).first()


def test_coach_registration_grants_the_longer_trial(client, db_session):
    _, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    assert org.subscription_status == SubscriptionStatus.TRIALING
    expected = datetime.now(timezone.utc) + timedelta(days=config.settings.billing_trial_days_coach)
    actual = org.trial_ends_at
    if actual.tzinfo is None:  # SQLite drops tzinfo on round-trip
        actual = actual.replace(tzinfo=timezone.utc)
    assert abs((actual - expected).total_seconds()) < 60


def test_non_coach_registration_grants_the_default_trial(client, db_session):
    _, user = _register_admin(client, db_session)
    org = _org_for(db_session, user)

    assert org.subscription_status == SubscriptionStatus.TRIALING
    expected = datetime.now(timezone.utc) + timedelta(days=config.settings.billing_trial_days_default)
    actual = org.trial_ends_at
    if actual.tzinfo is None:
        actual = actual.replace(tzinfo=timezone.utc)
    assert abs((actual - expected).total_seconds()) < 60


def test_status_reports_trial_countdown_with_billing_disabled(client, db_session, monkeypatch):
    """The trial is ours, not the provider's — it must survive
    BILLING_PROVIDER=disabled with no plans offered."""
    monkeypatch.setattr(config.settings, "billing_provider", "disabled")
    headers, _ = _register_coach(client, db_session)

    response = client.get("/api/billing/status", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["enabled"] is False
    assert data["plans"] == []
    assert data["subscription_status"] == "trialing"
    assert data["trial_days_left"] == config.settings.billing_trial_days_coach
    assert data["trial_ends_at"] is not None


def test_status_lists_plans_when_a_provider_is_configured(client, db_session):
    headers, _ = _register_coach(client, db_session)

    response = client.get("/api/billing/status", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["enabled"] is True
    assert {(p["plan"], p["interval"]) for p in data["plans"]} == {
        ("pro", "monthly"),
        ("pro", "yearly"),
        ("studio", "monthly"),
        ("studio", "yearly"),
    }
    assert all(p["amount_minor"] > 0 for p in data["plans"])


def test_status_reports_zero_days_left_once_the_trial_lapsed(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    org.trial_ends_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    data = client.get("/api/billing/status", headers=headers).json()
    assert data["trial_days_left"] == 0


def test_require_card_at_signup_is_reported_to_the_client(client, db_session, monkeypatch):
    monkeypatch.setattr(config.settings, "billing_require_card_at_signup", True)
    headers, _ = _register_coach(client, db_session)

    data = client.get("/api/billing/status", headers=headers).json()
    assert data["require_card_at_signup"] is True
