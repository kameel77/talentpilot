"""Tests for backend/services/billing/stripe_provider.py.

Phase 2b task brief §TESTS. Never calls the real Stripe API — every test
mocks the `stripe` SDK's entry points (`stripe.Webhook.construct_event`,
`stripe.checkout.Session.create`, `stripe.billing_portal.Session.create`,
`stripe.Subscription.cancel`). The real `stripe` package IS imported (it's
a hard dependency of `stripe_provider.py`), but no network call is ever
made — every test either mocks the specific SDK call or never reaches one
(e.g. the unconfigured-price-ID test, which must raise before calling
Stripe at all).

`webhook_handler.apply_webhook` is exercised unmodified — these tests
prove `StripeBillingProvider.parse_webhook` produces the exact same
`BillingEvent` shape the fake provider does, so no changes were needed
there (docs/BRIEF_BILLING_TRIAL.md §5, Phase 2b task brief §A).
"""
from datetime import datetime, timedelta, timezone

import pytest
import stripe

import config
from models import Organization, PlanTier, ProcessedBillingEvent, SubscriptionStatus, User
from services.billing.base import BillingEventType
from services.billing.stripe_provider import (
    StripeBillingProvider,
    StripeConfigurationError,
    _resolve_price_id,
)
from services.billing.webhook_handler import apply_webhook


def _configure_stripe_keys(monkeypatch):
    monkeypatch.setattr(config.settings, "stripe_secret_key", "sk_test_123")
    monkeypatch.setattr(config.settings, "stripe_webhook_secret", "whsec_test_123")


def _configure_prices(monkeypatch):
    monkeypatch.setattr(config.settings, "stripe_price_pro_monthly", "price_pro_monthly")
    monkeypatch.setattr(config.settings, "stripe_price_pro_yearly", "price_pro_yearly")
    monkeypatch.setattr(config.settings, "stripe_price_studio_monthly", "price_studio_monthly")
    monkeypatch.setattr(config.settings, "stripe_price_studio_yearly", "price_studio_yearly")


# ---------------------------------------------------------------------------
# parse_webhook — event fixtures -> BillingEvent
# ---------------------------------------------------------------------------


def _checkout_completed_payload(organization_id: int) -> dict:
    return {
        "id": "evt_checkout_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_1",
                "client_reference_id": str(organization_id),
                "customer": "cus_test_1",
                "subscription": "sub_test_1",
                "metadata": {},
            }
        },
    }


def _subscription_updated_payload(organization_id: int, price_id: str, status: str = "active") -> dict:
    return {
        "id": "evt_sub_updated_1",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_1",
                "customer": "cus_test_1",
                "status": status,
                "current_period_end": 1893456000,  # 2030-01-01T00:00:00Z
                "metadata": {"organization_id": str(organization_id)},
                "items": {"data": [{"price": {"id": price_id}, "current_period_end": 1893456000}]},
            }
        },
    }


def _subscription_deleted_payload(organization_id: int) -> dict:
    return {
        "id": "evt_sub_deleted_1",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_test_1",
                "customer": "cus_test_1",
                "status": "canceled",
                "metadata": {"organization_id": str(organization_id)},
            }
        },
    }


def _invoice_payment_failed_payload(organization_id: int) -> dict:
    return {
        "id": "evt_invoice_failed_1",
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "id": "in_test_1",
                "customer": "cus_test_1",
                "subscription": "sub_test_1",
                "subscription_details": {"metadata": {"organization_id": str(organization_id)}},
            }
        },
    }


def test_parse_webhook_checkout_completed(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook, "construct_event", lambda payload, sig, secret: _checkout_completed_payload(42)
    )

    provider = StripeBillingProvider()
    event = provider.parse_webhook(b"payload", "sig")

    assert event.event_id == "evt_checkout_1"
    assert event.type == BillingEventType.CHECKOUT_COMPLETED
    assert event.organization_id == 42
    assert event.customer_id == "cus_test_1"
    assert event.subscription_id == "sub_test_1"


def test_parse_webhook_subscription_updated_maps_plan_and_status(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    _configure_prices(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda payload, sig, secret: _subscription_updated_payload(42, "price_pro_monthly", status="active"),
    )

    provider = StripeBillingProvider()
    event = provider.parse_webhook(b"payload", "sig")

    assert event.type == BillingEventType.SUBSCRIPTION_UPDATED
    assert event.organization_id == 42
    assert event.raw["plan"] == "pro"
    assert event.raw["status"] == "active"
    assert event.current_period_end == datetime(2030, 1, 1, tzinfo=timezone.utc)
    # The dev-only extension consumed by webhook_handler's fake-provider
    # advance-trial tool must never be emitted by the real Stripe adapter.
    assert "trial_ends_at" not in event.raw


def test_parse_webhook_subscription_updated_unknown_stripe_status_maps_to_past_due(monkeypatch):
    """Stripe statuses with no first-class domain equivalent (unpaid,
    incomplete, ...) must map to something `SubscriptionStatus(...)` can
    actually construct, not raise."""
    _configure_stripe_keys(monkeypatch)
    _configure_prices(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda payload, sig, secret: _subscription_updated_payload(42, "price_pro_monthly", status="unpaid"),
    )

    provider = StripeBillingProvider()
    event = provider.parse_webhook(b"payload", "sig")
    assert event.raw["status"] == "past_due"
    assert SubscriptionStatus(event.raw["status"]) == SubscriptionStatus.PAST_DUE


def test_parse_webhook_subscription_deleted(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook, "construct_event", lambda payload, sig, secret: _subscription_deleted_payload(42)
    )

    provider = StripeBillingProvider()
    event = provider.parse_webhook(b"payload", "sig")

    assert event.type == BillingEventType.SUBSCRIPTION_DELETED
    assert event.organization_id == 42


def test_parse_webhook_invoice_payment_failed(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook, "construct_event", lambda payload, sig, secret: _invoice_payment_failed_payload(42)
    )

    provider = StripeBillingProvider()
    event = provider.parse_webhook(b"payload", "sig")

    assert event.type == BillingEventType.PAYMENT_FAILED
    assert event.organization_id == 42


def test_parse_webhook_unhandled_event_type_raises_value_error(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda payload, sig, secret: {"id": "evt_x", "type": "customer.updated", "data": {"object": {}}},
    )

    provider = StripeBillingProvider()
    with pytest.raises(ValueError):
        provider.parse_webhook(b"payload", "sig")


# ---------------------------------------------------------------------------
# Invalid signature -> raises, and (via the router) 400 with zero DB writes
# ---------------------------------------------------------------------------


def test_parse_webhook_invalid_signature_raises_permission_error(monkeypatch):
    _configure_stripe_keys(monkeypatch)

    def _raise_sig_error(payload, sig, secret):
        raise stripe.error.SignatureVerificationError("bad signature", sig)

    monkeypatch.setattr(stripe.Webhook, "construct_event", _raise_sig_error)

    provider = StripeBillingProvider()
    with pytest.raises(PermissionError):
        provider.parse_webhook(b"payload", "bad-sig")


def test_parse_webhook_malformed_payload_raises_value_error(monkeypatch):
    _configure_stripe_keys(monkeypatch)

    def _raise_value_error(payload, sig, secret):
        raise ValueError("invalid JSON")

    monkeypatch.setattr(stripe.Webhook, "construct_event", _raise_value_error)

    provider = StripeBillingProvider()
    with pytest.raises(ValueError):
        provider.parse_webhook(b"not json", "sig")


def test_invalid_signature_via_webhook_endpoint_returns_400_and_writes_nothing(
    client, db_session, monkeypatch
):
    """End-to-end through routers/billing.py + webhook_handler.apply_webhook
    — the SAME code path a real Stripe delivery uses, with only
    `stripe.Webhook.construct_event` mocked."""
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(config.settings, "billing_provider", "stripe")

    def _raise_sig_error(payload, sig, secret):
        raise stripe.error.SignatureVerificationError("bad signature", sig)

    monkeypatch.setattr(stripe.Webhook, "construct_event", _raise_sig_error)

    response = client.post(
        "/api/auth/register-coach",
        json={"email": "stripe-sig@example.com", "password": "password123", "full_name": "Stripe Sig"},
    )
    assert response.status_code == 201, response.text
    coach = db_session.query(User).filter(User.email == "stripe-sig@example.com").first()
    org = db_session.query(Organization).filter(Organization.id == coach.organization_id).first()

    webhook_response = client.post(
        "/api/billing/webhook",
        content=b'{"id": "evt_x"}',
        headers={"Content-Type": "application/json", "Stripe-Signature": "not-real"},
    )
    assert webhook_response.status_code == 400

    db_session.expire_all()
    org_after = db_session.query(Organization).filter(Organization.id == org.id).first()
    # Untouched by the rejected webhook — registration left it trialing.
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.billing_customer_id is None
    assert db_session.query(ProcessedBillingEvent).count() == 0


# ---------------------------------------------------------------------------
# Checkout price-ID resolution
# ---------------------------------------------------------------------------


def test_resolve_price_id_returns_configured_price(monkeypatch):
    _configure_prices(monkeypatch)
    assert _resolve_price_id(PlanTier.PRO, "monthly") == "price_pro_monthly"
    assert _resolve_price_id(PlanTier.STUDIO, "yearly") == "price_studio_yearly"


def test_resolve_price_id_unconfigured_raises_clear_error(monkeypatch):
    """No STUDIO_YEARLY price configured — must raise BEFORE ever calling
    Stripe, never pass `price=None` into `stripe.checkout.Session.create`."""
    monkeypatch.setattr(config.settings, "stripe_price_studio_yearly", None)
    with pytest.raises(StripeConfigurationError):
        _resolve_price_id(PlanTier.STUDIO, "yearly")


def test_create_checkout_session_unconfigured_price_never_calls_stripe(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    monkeypatch.setattr(config.settings, "stripe_price_studio_yearly", None)

    def _fail_if_called(**kwargs):
        raise AssertionError("stripe.checkout.Session.create must not be called")

    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(_fail_if_called))

    provider = StripeBillingProvider()
    fake_org = Organization(id=1, name="Org", is_workspace=True)
    fake_user = User(id=1, email="coach@example.com", full_name="Coach", hashed_password="x", organization_id=1)

    with pytest.raises(StripeConfigurationError):
        provider.create_checkout_session(fake_org, fake_user, PlanTier.STUDIO, "yearly")


def test_create_checkout_session_builds_expected_stripe_call(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    _configure_prices(monkeypatch)

    captured = {}

    class _FakeSession:
        url = "https://checkout.stripe.com/pay/cs_test_captured"
        id = "cs_test_captured"

    def _capture_create(**kwargs):
        captured.update(kwargs)
        return _FakeSession()

    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(_capture_create))

    provider = StripeBillingProvider()
    fake_org = Organization(id=7, name="Org", is_workspace=True)
    fake_user = User(id=1, email="coach@example.com", full_name="Coach", hashed_password="x", organization_id=7)

    session = provider.create_checkout_session(fake_org, fake_user, PlanTier.PRO, "yearly")

    assert session.session_id == "cs_test_captured"
    assert captured["mode"] == "subscription"
    assert set(captured["payment_method_types"]) == {"card", "blik"}
    assert captured["line_items"] == [{"price": "price_pro_yearly", "quantity": 1}]
    # No product-led trial left on this org (status defaults to FREE), so
    # Stripe is asked for no trial at all rather than a fresh 14 days.
    assert "trial_period_days" not in captured["subscription_data"]
    assert captured["subscription_data"]["metadata"]["organization_id"] == "7"
    assert captured["payment_method_collection"] == "always"
    assert captured["tax_id_collection"] == {"enabled": True}
    assert captured["billing_address_collection"] == "required"
    assert captured["client_reference_id"] == "7"


# ---------------------------------------------------------------------------
# cancel_subscription / get_portal_url
# ---------------------------------------------------------------------------


def test_checkout_trial_is_the_remainder_of_the_product_led_trial(monkeypatch):
    """Subscribing mid-trial buys the days that are left, never a new 14/30.

    Guards the one way a customer could otherwise stack two free periods:
    run the card-free trial to day 29, then enter a card and receive a
    second full trial from Stripe.
    """
    _configure_stripe_keys(monkeypatch)
    _configure_prices(monkeypatch)

    captured = {}

    class _FakeSession:
        url = "https://checkout.stripe.com/pay/cs_test_trial"
        id = "cs_test_trial"

    monkeypatch.setattr(
        stripe.checkout.Session,
        "create",
        staticmethod(lambda **kwargs: (captured.update(kwargs), _FakeSession())[1]),
    )

    provider = StripeBillingProvider()
    fake_org = Organization(
        id=9,
        name="Org",
        is_workspace=True,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=10),
    )
    fake_user = User(id=1, email="coach@example.com", full_name="Coach", hashed_password="x", organization_id=9)

    provider.create_checkout_session(fake_org, fake_user, PlanTier.PRO, "monthly")

    assert captured["subscription_data"]["trial_period_days"] == 10


def test_get_portal_url_without_customer_id_raises_clear_error(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    provider = StripeBillingProvider()
    fake_org = Organization(id=1, name="Org", is_workspace=True, billing_customer_id=None)
    with pytest.raises(StripeConfigurationError):
        provider.get_portal_url(fake_org)


def test_get_portal_url_returns_stripe_url(monkeypatch):
    _configure_stripe_keys(monkeypatch)

    class _FakePortalSession:
        url = "https://billing.stripe.com/session/test"

    monkeypatch.setattr(
        stripe.billing_portal.Session, "create", staticmethod(lambda **kwargs: _FakePortalSession())
    )

    provider = StripeBillingProvider()
    fake_org = Organization(id=1, name="Org", is_workspace=True, billing_customer_id="cus_test_1")
    url = provider.get_portal_url(fake_org)
    assert url == "https://billing.stripe.com/session/test"


def test_cancel_subscription_without_subscription_id_is_a_noop(monkeypatch):
    _configure_stripe_keys(monkeypatch)

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("stripe.Subscription.cancel must not be called")

    monkeypatch.setattr(stripe.Subscription, "cancel", staticmethod(_fail_if_called))

    provider = StripeBillingProvider()
    fake_org = Organization(id=1, name="Org", is_workspace=True, billing_subscription_id=None)
    provider.cancel_subscription(fake_org)  # must not raise


def test_cancel_subscription_calls_stripe(monkeypatch):
    _configure_stripe_keys(monkeypatch)
    captured = {}
    monkeypatch.setattr(
        stripe.Subscription, "cancel", staticmethod(lambda sub_id: captured.setdefault("id", sub_id))
    )

    provider = StripeBillingProvider()
    fake_org = Organization(id=1, name="Org", is_workspace=True, billing_subscription_id="sub_test_1")
    provider.cancel_subscription(fake_org)
    assert captured["id"] == "sub_test_1"
