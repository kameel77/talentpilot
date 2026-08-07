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


def test_factory_raises_not_implemented_for_stripe(monkeypatch):
    """Settings' own boot guard normally prevents billing_provider='stripe'
    from ever existing at runtime — this exercises the factory's defensive
    branch directly by monkeypatching past that guard."""
    monkeypatch.setattr(config.settings, "billing_provider", "stripe")
    with pytest.raises(NotImplementedError):
        get_billing_provider()


def test_factory_raises_value_error_for_unknown_provider(monkeypatch):
    monkeypatch.setattr(config.settings, "billing_provider", "payu")
    with pytest.raises(ValueError):
        get_billing_provider()
