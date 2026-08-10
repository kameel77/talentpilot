"""Tests for backend/services/billing/provider.py — the ONLY thing routers
may import from services.billing (docs/BRIEF_BILLING_TRIAL.md §5).
"""
import pytest

import config
from services.billing.fake_provider import FakeBillingProvider
from services.billing.provider import get_billing_provider


def test_factory_returns_none_when_disabled(monkeypatch):
    monkeypatch.setattr(config.settings, "billing_provider", "disabled")
    assert get_billing_provider() is None


def test_factory_returns_fake_provider_instance(monkeypatch):
    monkeypatch.setattr(config.settings, "billing_provider", "fake")
    provider = get_billing_provider()
    assert isinstance(provider, FakeBillingProvider)


def test_factory_returns_stripe_provider_instance(monkeypatch):
    """Settings' own boot guard (backend/config.py) is what normally keeps
    `billing_provider='stripe'` from reaching this function without both
    Stripe secrets configured — this test bypasses that guard the same way
    the other tests in this file do (direct monkeypatch of the settings
    singleton) to exercise the factory branch itself in isolation."""
    from services.billing.stripe_provider import StripeBillingProvider

    monkeypatch.setattr(config.settings, "billing_provider", "stripe")
    monkeypatch.setattr(config.settings, "stripe_secret_key", "sk_test_123")
    monkeypatch.setattr(config.settings, "stripe_webhook_secret", "whsec_test")
    provider = get_billing_provider()
    assert isinstance(provider, StripeBillingProvider)


def test_factory_raises_value_error_for_unknown_provider(monkeypatch):
    monkeypatch.setattr(config.settings, "billing_provider", "payu")
    with pytest.raises(ValueError):
        get_billing_provider()
