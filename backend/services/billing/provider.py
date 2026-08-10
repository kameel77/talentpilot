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

    `billing_provider="stripe"` without `stripe_secret_key`/
    `stripe_webhook_secret` cannot actually reach this function in a running
    app — `Settings`' boot guard (`backend/config.py`) already raises at
    `Settings()` construction time, before the app even starts. The
    `stripe` branch below is reachable in practice (a correctly configured
    prod/staging deploy), unlike the old placeholder.

    The `stripe_provider` import is intentionally local to this branch, not
    at module top — `services/billing/stripe_provider.py` is the only
    module in the codebase that imports the `stripe` SDK (see its
    docstring and docs/BRIEF_BILLING_TRIAL.md §5). Keeping the import lazy
    means `disabled`/`fake` deployments (and most of the test suite) never
    load the `stripe` package at all, so a missing/broken `stripe`
    installation can't break anything except an actual `billing_provider=
    "stripe"` deployment.
    """
    provider = settings.billing_provider

    if provider == "disabled":
        return None

    if provider == "fake":
        return FakeBillingProvider()

    if provider == "stripe":
        from .stripe_provider import StripeBillingProvider

        return StripeBillingProvider()

    raise ValueError(f"Unknown billing_provider setting: {provider!r}")
