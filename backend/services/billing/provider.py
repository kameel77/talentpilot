"""Billing provider factory — the ONLY thing routers/domain code may import
from this package (docs/BRIEF_BILLING_TRIAL.md §5).

`get_billing_provider()` reads `settings.billing_provider` and returns the
matching adapter, or `None` for `"disabled"`. Callers check for `None` and
respond 503 (checkout/portal) or 404 (webhook) — see `routers/billing.py`.
"""
from config import settings

from .base import BillingProvider
from .fake_provider import FakeBillingProvider


def get_billing_provider() -> BillingProvider | None:
    """Return the configured billing provider, or None when billing is off.

    `billing_provider="stripe"` cannot actually reach this function in a
    running app — `Settings`' boot guard (`backend/config.py`) already
    raises `NotImplementedError` the moment such a config is loaded, before
    the app even starts. The branch below is defensive only, for callers
    that construct/monkeypatch settings directly (e.g. tests).
    """
    provider = settings.billing_provider

    if provider == "disabled":
        return None

    if provider == "fake":
        return FakeBillingProvider()

    if provider == "stripe":
        raise NotImplementedError(
            "billing_provider='stripe' is not implemented yet — the Stripe "
            "adapter (services/billing/stripe_provider.py) lands in the next "
            "phase. See docs/BRIEF_BILLING_TRIAL.md §6."
        )

    raise ValueError(f"Unknown billing_provider setting: {provider!r}")
