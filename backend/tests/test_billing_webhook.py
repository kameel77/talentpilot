"""Tests for the billing webhook state machine and the checkout/portal/dev
endpoints built on top of it.

Covers docs/BRIEF_BILLING_TRIAL.md §6 transitions and the Phase-2 task
brief's TESTS section: signature verification (and zero DB writes on
failure), idempotency, the "must not shorten a manually granted trial"
guarantee, SUBSCRIPTION_DELETED leaving data readable, and the full fake
checkout -> TRIALING -> plan-limits -> advance-trial flow.
"""
import json
from datetime import datetime, timedelta, timezone

from config import settings
from models import Organization, PlanTier, ProcessedBillingEvent, SubscriptionStatus, User
from services.billing.base import BillingEventType
from services.billing.fake_provider import FakeBillingProvider


def _register_coach(client, db_session, email="coach@example.com", full_name="Anna Kowalska"):
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    coach = db_session.query(User).filter(User.email == email).first()
    return {"Authorization": f"Bearer {data['access_token']}"}, coach


def _org_for(db_session, coach):
    return db_session.query(Organization).filter(Organization.id == coach.organization_id).first()


def _build_event(event_type: BillingEventType, organization_id, **fields):
    provider = FakeBillingProvider()
    return provider.build_dev_webhook(event_type, organization_id, **fields)


def _post_webhook(client, payload: bytes, signature: str):
    return client.post(
        "/api/billing/webhook",
        content=payload,
        headers={"Content-Type": "application/json", "X-Billing-Signature": signature},
    )


def _aware(dt: datetime) -> datetime:
    """SQLite drops tzinfo on round-trip — normalize back to UTC for
    comparisons, same defensive pattern plan_limits.py uses."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def test_invalid_signature_returns_400_and_writes_nothing(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    payload, _real_signature = _build_event(BillingEventType.CHECKOUT_COMPLETED, org.id)
    response = _post_webhook(client, payload, "not-the-real-signature")

    assert response.status_code == 400

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    # Untouched by the rejected webhook — registration left it trialing.
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.billing_customer_id is None
    assert db_session.query(ProcessedBillingEvent).count() == 0


def test_missing_signature_header_returns_400(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    payload, _ = _build_event(BillingEventType.CHECKOUT_COMPLETED, org.id)

    response = client.post(
        "/api/billing/webhook",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400


def test_webhook_returns_404_when_billing_disabled(client, db_session, monkeypatch):
    import config
    monkeypatch.setattr(config.settings, "billing_provider", "disabled")

    response = client.post(
        "/api/billing/webhook",
        content=b"{}",
        headers={"Content-Type": "application/json", "X-Billing-Signature": "whatever"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# CHECKOUT_COMPLETED
# ---------------------------------------------------------------------------

def test_valid_signature_applies_checkout_completed_transition(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    # Registration grants the product-led trial, so this org arrives at
    # checkout already trialing rather than with an empty trial window.
    assert org.trial_ends_at is not None

    payload, signature = _build_event(
        BillingEventType.CHECKOUT_COMPLETED,
        org.id,
        customer_id="cus_1",
        subscription_id="sub_1",
        payment_method_last4="4242",
    )
    response = _post_webhook(client, payload, signature)
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.billing_customer_id == "cus_1"
    assert org_after.billing_subscription_id == "sub_1"
    assert org_after.payment_method_last4 == "4242"
    assert org_after.trial_ends_at is not None

    # Checkout never shortens an existing trial: the coach's 30-day
    # registration trial survives instead of being reset to the default.
    expected = datetime.now(timezone.utc) + timedelta(days=settings.billing_trial_days_coach)
    assert abs((_aware(org_after.trial_ends_at) - expected).total_seconds()) < 60


def test_checkout_completed_does_not_shorten_manually_set_90_day_trial(client, db_session):
    """docs §4/§6: a design partner's manually granted trial must never be
    clobbered by a subsequent real checkout."""
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    ninety_days = datetime.now(timezone.utc) + timedelta(days=90)
    org.trial_ends_at = ninety_days
    org.subscription_status = SubscriptionStatus.TRIALING
    db_session.commit()

    payload, signature = _build_event(BillingEventType.CHECKOUT_COMPLETED, org.id, customer_id="cus_dp")
    response = _post_webhook(client, payload, signature)
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.trial_ends_at is not None
    assert abs((_aware(org_after.trial_ends_at) - ninety_days).total_seconds()) < 1
    assert org_after.billing_customer_id == "cus_dp"


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def test_duplicate_event_is_applied_once(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    payload, signature = _build_event(
        BillingEventType.CHECKOUT_COMPLETED, org.id, customer_id="cus_dup", subscription_id="sub_dup"
    )
    first = _post_webhook(client, payload, signature)
    assert first.status_code == 200
    second = _post_webhook(client, payload, signature)
    assert second.status_code == 200
    assert second.json()["status"] == "already_processed"

    db_session.expire_all()
    event_id = json.loads(payload)["event_id"]
    count = (
        db_session.query(ProcessedBillingEvent)
        .filter(ProcessedBillingEvent.event_id == event_id)
        .count()
    )
    assert count == 1

    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.billing_customer_id == "cus_dup"


# ---------------------------------------------------------------------------
# SUBSCRIPTION_UPDATED
# ---------------------------------------------------------------------------

def test_subscription_updated_syncs_plan_status_and_period_end(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    period_end = datetime.now(timezone.utc) + timedelta(days=30)
    payload, signature = _build_event(
        BillingEventType.SUBSCRIPTION_UPDATED,
        org.id,
        plan="pro",
        status="active",
        current_period_end=period_end.isoformat(),
    )
    response = _post_webhook(client, payload, signature)
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.plan == PlanTier.PRO
    assert org_after.subscription_status == SubscriptionStatus.ACTIVE
    assert org_after.current_period_end is not None


# ---------------------------------------------------------------------------
# SUBSCRIPTION_DELETED — downgrade, data stays readable
# ---------------------------------------------------------------------------

def test_subscription_deleted_downgrades_to_free_and_data_stays_readable(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    org.plan = PlanTier.PRO
    org.subscription_status = SubscriptionStatus.ACTIVE
    db_session.commit()

    created_org = client.post("/api/organizations", json={"name": "Client Org"}, headers=headers)
    assert created_org.status_code == 201, created_org.text
    created_profile = client.post(
        "/api/invitations/ghost",
        json={"full_name": "Some Profile", "organization_id": org.id},
        headers=headers,
    )
    assert created_profile.status_code == 201, created_profile.text

    payload, signature = _build_event(BillingEventType.SUBSCRIPTION_DELETED, org.id)
    response = _post_webhook(client, payload, signature)
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.plan == PlanTier.FREE
    assert org_after.subscription_status == SubscriptionStatus.FREE

    orgs_response = client.get("/api/organizations", headers=headers)
    assert orgs_response.status_code == 200
    assert any(o["name"] == "Client Org" for o in orgs_response.json())

    users_response = client.get("/api/users", headers=headers)
    assert users_response.status_code == 200
    assert any(u["full_name"] == "Some Profile" for u in users_response.json())


# ---------------------------------------------------------------------------
# PAYMENT_FAILED
# ---------------------------------------------------------------------------

def test_payment_failed_sets_past_due(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    payload, signature = _build_event(BillingEventType.PAYMENT_FAILED, org.id)
    response = _post_webhook(client, payload, signature)
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.subscription_status == SubscriptionStatus.PAST_DUE


# ---------------------------------------------------------------------------
# Checkout / portal endpoints
# ---------------------------------------------------------------------------

def test_checkout_returns_dev_stub_url(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    response = client.post("/api/billing/checkout", json={"plan": "pro"}, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert f"org={org.id}" in data["url"]
    assert "/dev/checkout" in data["url"]
    assert data["session_id"]


def test_portal_returns_url(client, db_session):
    headers, coach = _register_coach(client, db_session)
    response = client.get("/api/billing/portal", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["url"]


def test_checkout_and_portal_503_when_billing_disabled(client, db_session, monkeypatch):
    import config
    monkeypatch.setattr(config.settings, "billing_provider", "disabled")

    headers, coach = _register_coach(client, db_session)
    checkout = client.post("/api/billing/checkout", json={"plan": "pro"}, headers=headers)
    assert checkout.status_code == 503

    portal = client.get("/api/billing/portal", headers=headers)
    assert portal.status_code == 503


# ---------------------------------------------------------------------------
# Full fake flow: checkout -> webhook -> TRIALING -> limits lifted ->
# advance-trial -> limits re-apply
# ---------------------------------------------------------------------------

def test_full_fake_checkout_flow_then_advance_trial_reapplies_limits(client, db_session, auth_headers_admin):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    checkout = client.post("/api/billing/checkout", json={"plan": "pro"}, headers=headers)
    assert checkout.status_code == 200, checkout.text
    session_id = checkout.json()["session_id"]

    callback = client.post(
        "/api/billing/checkout/callback",
        json={"session_id": session_id, "organization_id": org.id, "outcome": "success"},
        headers=headers,
    )
    assert callback.status_code == 200, callback.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.trial_ends_at is not None

    # Plan limits (Phase 1) no longer raise while trialing — Free's
    # client_orgs limit is 1, create well past that.
    for i in range(3):
        response = client.post("/api/organizations", json={"name": f"Client {i}"}, headers=headers)
        assert response.status_code == 201, response.text

    # Fast-forward the trial via the admin dev tool.
    advance = client.post(
        "/api/dev/billing/advance-trial",
        json={"organization_id": org.id},
        headers=auth_headers_admin,
    )
    assert advance.status_code == 200, advance.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert _aware(org_after.trial_ends_at) < datetime.now(timezone.utc)

    # Limits apply again — the coach already has 3 client orgs (> Free's
    # limit of 1), so the next create is rejected.
    over_limit = client.post("/api/organizations", json={"name": "Should fail"}, headers=headers)
    assert over_limit.status_code == 402, over_limit.text


def test_checkout_callback_declined_card_sets_payment_failed(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    checkout = client.post("/api/billing/checkout", json={"plan": "pro"}, headers=headers)
    session_id = checkout.json()["session_id"]

    callback = client.post(
        "/api/billing/checkout/callback",
        json={"session_id": session_id, "organization_id": org.id, "outcome": "failed"},
        headers=headers,
    )
    assert callback.status_code == 200, callback.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.subscription_status == SubscriptionStatus.PAST_DUE


def test_checkout_callback_requires_org_access(client, db_session):
    headers_a, coach_a = _register_coach(client, db_session, email="a@example.com", full_name="Coach A")
    headers_b, coach_b = _register_coach(client, db_session, email="b@example.com", full_name="Coach B")
    org_b = _org_for(db_session, coach_b)

    response = client.post(
        "/api/billing/checkout/callback",
        json={"session_id": "fake_cs_x", "organization_id": org_b.id, "outcome": "success"},
        headers=headers_a,
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Dev billing simulation endpoints — admin-only
# ---------------------------------------------------------------------------

def test_dev_billing_requires_admin_role(client, db_session):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    response = client.post(
        "/api/dev/billing/advance-trial", json={"organization_id": org.id}, headers=headers
    )
    assert response.status_code == 403


def test_dev_billing_simulate_payment_failure(client, db_session, auth_headers_admin):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)

    response = client.post(
        "/api/dev/billing/simulate-payment-failure",
        json={"organization_id": org.id},
        headers=auth_headers_admin,
    )
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.subscription_status == SubscriptionStatus.PAST_DUE


def test_dev_billing_expire_subscription(client, db_session, auth_headers_admin):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    org.plan = PlanTier.PRO
    org.subscription_status = SubscriptionStatus.ACTIVE
    db_session.commit()

    response = client.post(
        "/api/dev/billing/expire-subscription",
        json={"organization_id": org.id},
        headers=auth_headers_admin,
    )
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.plan == PlanTier.FREE
    assert org_after.subscription_status == SubscriptionStatus.FREE


def test_dev_billing_reset_to_free(client, db_session, auth_headers_admin):
    headers, coach = _register_coach(client, db_session)
    org = _org_for(db_session, coach)
    org.plan = PlanTier.STUDIO
    org.subscription_status = SubscriptionStatus.ACTIVE
    db_session.commit()

    response = client.post(
        "/api/dev/billing/reset-to-free",
        json={"organization_id": org.id},
        headers=auth_headers_admin,
    )
    assert response.status_code == 200, response.text

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    assert org_after.plan == PlanTier.FREE
    assert org_after.subscription_status == SubscriptionStatus.FREE


def test_dev_billing_404_for_unknown_organization(client, db_session, auth_headers_admin):
    response = client.post(
        "/api/dev/billing/advance-trial",
        json={"organization_id": 999999},
        headers=auth_headers_admin,
    )
    assert response.status_code == 404
