"""Tests for the billing provider boot guard (backend/config.py).

See docs/BRIEF_BILLING_TRIAL.md §5-6, Phase 2 task brief §2. The guard is a
`model_validator` on `Settings`, so we exercise it by constructing `Settings`
directly rather than through the module-level `settings` singleton.
"""
import pytest

from config import Settings

_REQUIRED = dict(database_url="sqlite:///:memory:", jwt_secret="x", openai_api_key="x")


def _settings(**overrides) -> Settings:
    return Settings(**_REQUIRED, **overrides)


def test_disabled_in_production_is_allowed():
    """`disabled` must remain valid in production — today's live deploy
    runs with no billing infra at all."""
    s = _settings(environment="production", billing_provider="disabled")
    assert s.billing_provider == "disabled"
    assert s.environment == "production"


def test_disabled_in_development_is_allowed():
    s = _settings(environment="development", billing_provider="disabled")
    assert s.billing_provider == "disabled"


def test_fake_in_production_raises_runtime_error():
    with pytest.raises(RuntimeError):
        _settings(environment="production", billing_provider="fake")


def test_fake_in_development_is_allowed():
    s = _settings(environment="development", billing_provider="fake")
    assert s.billing_provider == "fake"


def test_fake_in_staging_is_allowed():
    """The guard is scoped to `environment == "production"` specifically —
    any other environment name is fine with `fake`."""
    s = _settings(environment="staging", billing_provider="fake")
    assert s.billing_provider == "fake"


def test_stripe_without_secret_key_raises_at_boot():
    """The Stripe adapter (Phase 2b) exists, but can't authenticate to
    Stripe or verify webhook signatures without both secrets — fail loud at
    boot rather than start into a provider that 500s on first use."""
    with pytest.raises(RuntimeError):
        _settings(
            environment="development",
            billing_provider="stripe",
            stripe_webhook_secret="whsec_test",
            # stripe_secret_key intentionally omitted
        )


def test_stripe_without_webhook_secret_raises_at_boot():
    with pytest.raises(RuntimeError):
        _settings(
            environment="development",
            billing_provider="stripe",
            stripe_secret_key="sk_test_123",
            # stripe_webhook_secret intentionally omitted
        )


def test_stripe_without_either_key_raises_at_boot():
    with pytest.raises(RuntimeError):
        _settings(environment="development", billing_provider="stripe")


def test_stripe_with_both_keys_set_constructs_fine():
    s = _settings(
        environment="development",
        billing_provider="stripe",
        stripe_secret_key="sk_test_123",
        stripe_webhook_secret="whsec_test",
    )
    assert s.billing_provider == "stripe"


def test_stripe_with_both_keys_set_constructs_fine_in_production():
    """`stripe` is the intended production provider — unlike `fake`, it is
    not refused in production once properly configured."""
    s = _settings(
        environment="production",
        billing_provider="stripe",
        stripe_secret_key="sk_live_123",
        stripe_webhook_secret="whsec_live",
    )
    assert s.billing_provider == "stripe"
    assert s.environment == "production"


def test_unknown_billing_provider_value_is_rejected():
    with pytest.raises(Exception):
        _settings(billing_provider="payu")


def test_billing_provider_defaults_to_disabled(monkeypatch):
    # tests/conftest.py sets BILLING_PROVIDER=fake process-wide so the rest
    # of the suite can exercise the billing routers — remove it here to
    # test the actual field default in isolation.
    monkeypatch.delenv("BILLING_PROVIDER", raising=False)
    s = _settings()
    assert s.billing_provider == "disabled"
