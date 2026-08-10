"""Tests for the production gate on `webhook_handler._apply_transition`'s
dev-only `trial_ends_at` extension (Phase 2b task brief §A).

`raw["trial_ends_at"]` on a SUBSCRIPTION_UPDATED event is a fake-provider/
dev-tooling-only extension (see fake_provider.py, routers/dev_billing.py's
advance-trial tool) — real Stripe events never carry it. Before this gate,
a validly-signed payload carrying that key would still extend a trial in
production if it ever got through; the gate makes that structurally
impossible regardless of environment.
"""
from datetime import datetime, timedelta, timezone

from models import Organization, SubscriptionStatus
from services.billing.base import BillingEvent, BillingEventType
from services.billing.webhook_handler import _apply_transition


def _make_org(**overrides) -> Organization:
    defaults = dict(name="Org", is_workspace=True, subscription_status=SubscriptionStatus.TRIALING)
    defaults.update(overrides)
    return Organization(**defaults)


def _subscription_updated_event(trial_ends_at_iso: str) -> BillingEvent:
    return BillingEvent(
        event_id="evt_1",
        type=BillingEventType.SUBSCRIPTION_UPDATED,
        organization_id=1,
        subscription_id=None,
        customer_id=None,
        current_period_end=None,
        payment_method_last4=None,
        raw={"trial_ends_at": trial_ends_at_iso},
    )


def test_trial_ends_at_override_applied_outside_production(monkeypatch):
    import config

    monkeypatch.setattr(config.settings, "environment", "development")
    org = _make_org(trial_ends_at=datetime.now(timezone.utc))
    future = datetime.now(timezone.utc) + timedelta(days=30)

    _apply_transition(org, _subscription_updated_event(future.isoformat()))

    assert abs((org.trial_ends_at - future).total_seconds()) < 1


def test_trial_ends_at_override_ignored_in_production(monkeypatch):
    import config

    monkeypatch.setattr(config.settings, "environment", "production")
    original = datetime.now(timezone.utc) + timedelta(days=5)
    org = _make_org(trial_ends_at=original)
    attacker_supplied = datetime.now(timezone.utc) + timedelta(days=365)

    _apply_transition(org, _subscription_updated_event(attacker_supplied.isoformat()))

    # Untouched — the gate short-circuits before this key is ever read in
    # production, regardless of how the payload was signed.
    assert abs((org.trial_ends_at - original).total_seconds()) < 1
