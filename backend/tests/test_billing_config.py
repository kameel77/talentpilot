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


def test_stripe_raises_not_implemented_in_development():
    with pytest.raises(NotImplementedError):
        _settings(environment="development", billing_provider="stripe")


def test_stripe_raises_not_implemented_in_production():
    with pytest.raises(NotImplementedError):
        _settings(environment="production", billing_provider="stripe")


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
