"""Stripe billing provider (docs/BRIEF_BILLING_TRIAL.md §6, Phase 2b).

Implements `BillingProvider` (`services/billing/base.py`) against the real
Stripe API. This is the ONLY module in the codebase that imports the
`stripe` SDK (docs §5) — no router, no other service, may `import stripe`
directly. `services/billing/provider.py` imports this module lazily, only
when `billing_provider="stripe"`, so a missing/broken `stripe` package
can't break `disabled`/`fake` deployments or most of the test suite.

Every public method returns the exact same provider-neutral
`CheckoutSession` / `BillingEvent` shapes the fake provider returns
(`fake_provider.py`), so `services/billing/webhook_handler.py` — the state
machine that actually mutates `Organization` rows — needs ZERO changes to
handle real Stripe webhooks. If implementing something here ever seems to
require touching `webhook_handler.py`, that's a signal this mapping is
wrong, not that the handler needs to grow Stripe-specific branches.
"""
from datetime import datetime, timezone
from typing import Any, Optional

import stripe

from config import settings
from models import PlanTier

from .base import BillingEvent, BillingEventType, BillingProvider, CheckoutSession


class StripeConfigurationError(RuntimeError):
    """Raised when a checkout/portal request can't be satisfied with the
    current Stripe configuration — e.g. no price ID configured for a
    plan+interval, or no `billing_customer_id` yet for a portal session.

    Deliberately NOT a plain `ValueError`: `parse_webhook` uses `ValueError`
    (malformed payload) and `PermissionError` (bad signature) as the two
    signals `webhook_handler.apply_webhook` translates into "400, no DB
    writes" (see base.py's docstring) — this exception means something
    different (a config/ops problem on OUR side, not a bad request from
    Stripe) and must never be caught by that same handling path.
    """


# Off-session BLIK charges (BLIK Model O — what makes BLIK usable for
# *recurring* subscription renewals, not just the first payment) are capped
# by Stripe/BLIK at 2000 PLN per transaction. See
# docs/BRIEF_BILLING_TRIAL.md §6 and https://docs.stripe.com/payments/blik.
# Today's plans (Pro 249 PLN, Studio 499 PLN monthly, plus discounted yearly
# equivalents) sit far under this. A future enterprise/team plan priced at
# or above ~2000 PLN/month would silently fail off-session BLIK renewal
# charges — re-check this limit before configuring a price anywhere near it.
BLIK_OFF_SESSION_LIMIT_PLN = 2000

# Stripe subscription `status` values that have no first-class equivalent
# in our domain (`models.SubscriptionStatus`: trialing/active/past_due/
# canceled/free). Mapped to "past_due" — the conservative choice, since it
# keeps plan-limit write paths locked (services/plan_limits.py) rather than
# silently granting unlimited access — instead of raising and turning an
# unusual-but-valid Stripe status into a hard webhook failure.
_STRIPE_STATUS_TO_DOMAIN = {
    "trialing": "trialing",
    "active": "active",
    "past_due": "past_due",
    "canceled": "canceled",
    "unpaid": "past_due",
    "incomplete": "past_due",
    "incomplete_expired": "past_due",
    "paused": "past_due",
}

_STRIPE_EVENT_TYPE_MAP = {
    "checkout.session.completed": BillingEventType.CHECKOUT_COMPLETED,
    "customer.subscription.updated": BillingEventType.SUBSCRIPTION_UPDATED,
    "customer.subscription.deleted": BillingEventType.SUBSCRIPTION_DELETED,
    "invoice.payment_failed": BillingEventType.PAYMENT_FAILED,
}


def _price_ids() -> dict[tuple[PlanTier, str], Optional[str]]:
    """Read price IDs from `settings` on every call (not cached at import
    time) so tests can monkeypatch `config.settings` and see the change —
    same pattern the rest of `services/billing/` already uses for
    `settings.billing_webhook_secret` etc.

    Amounts are never hardcoded here or anywhere else in this codebase
    (Phase 2b task brief §A) — only these opaque price IDs, configured per
    environment. The actual PLN amounts live in the Stripe Dashboard.
    """
    return {
        (PlanTier.PRO, "monthly"): settings.stripe_price_pro_monthly,
        (PlanTier.PRO, "yearly"): settings.stripe_price_pro_yearly,
        (PlanTier.STUDIO, "monthly"): settings.stripe_price_studio_monthly,
        (PlanTier.STUDIO, "yearly"): settings.stripe_price_studio_yearly,
    }


def _resolve_price_id(plan: PlanTier, interval: str) -> str:
    if interval not in ("monthly", "yearly"):
        raise StripeConfigurationError(
            f"Unknown billing interval {interval!r} — must be 'monthly' or 'yearly'"
        )
    price_id = _price_ids().get((PlanTier(plan), interval))
    if not price_id:
        raise StripeConfigurationError(
            f"No Stripe price ID configured for plan={PlanTier(plan).value!r} "
            f"interval={interval!r}. Set the matching STRIPE_PRICE_* environment "
            "variable before offering this plan at checkout."
        )
    return price_id


class StripeBillingProvider(BillingProvider):
    """Implements `BillingProvider` against the real Stripe API."""

    webhook_signature_header = "Stripe-Signature"

    def __init__(self) -> None:
        stripe.api_key = settings.stripe_secret_key

    # -- checkout / portal / cancel --------------------------------------

    def create_checkout_session(
        self, organization, user, plan: PlanTier, interval: str = "monthly"
    ) -> CheckoutSession:
        """Hosted Stripe Checkout, subscription mode, 14-day trial.

        Card required up front (`payment_method_collection="always"`) —
        this is what makes "trial now, auto-charge later" possible without
        us building any 3DS/SCA handling ourselves (docs §6). NIP + billing
        address collection feed Fakturownia's Stripe integration (docs §7).
        """
        price_id = _resolve_price_id(plan, interval)
        base_url = settings.frontend_url.rstrip("/")

        session = stripe.checkout.Session.create(
            mode="subscription",
            # Card + BLIK (Model O — see BLIK_OFF_SESSION_LIMIT_PLN above)
            # for the PL market, per docs §6.
            payment_method_types=["card", "blik"],
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={
                "trial_period_days": 14,
                # Carried onto the created Subscription object, and — as of
                # Stripe API 2022-11-15 — snapshotted onto every invoice's
                # `subscription_details.metadata`. That lets
                # `parse_webhook` resolve our internal `organization.id`
                # straight from `customer.subscription.*` and
                # `invoice.payment_failed` events without a DB round-trip
                # (this module has no DB session to query with — see
                # `BillingProvider.parse_webhook`'s signature in base.py).
                "metadata": {"organization_id": str(organization.id)},
            },
            payment_method_collection="always",
            tax_id_collection={"enabled": True},
            billing_address_collection="required",
            # `checkout.session.completed` carries this straight through —
            # the other, cheaper way (vs. subscription metadata above) to
            # resolve organization_id, used for that one event type.
            client_reference_id=str(organization.id),
            customer_email=getattr(user, "email", None) or None,
            success_url=f"{base_url}/dashboard?checkout=success",
            cancel_url=f"{base_url}/dashboard?checkout=cancelled",
        )
        return CheckoutSession(url=session.url, session_id=session.id)

    def cancel_subscription(self, organization) -> None:
        if not organization.billing_subscription_id:
            # Nothing to cancel at the provider — mirrors the fake
            # provider's no-op (fake_provider.py) rather than raising, so
            # callers don't need to special-case "org never actually
            # subscribed".
            return
        stripe.Subscription.cancel(organization.billing_subscription_id)

    def get_portal_url(self, organization) -> str:
        if not organization.billing_customer_id:
            raise StripeConfigurationError(
                f"Organization {organization.id} has no billing_customer_id yet — "
                "the Customer Portal requires at least one completed checkout."
            )
        base_url = settings.frontend_url.rstrip("/")
        portal_session = stripe.billing_portal.Session.create(
            customer=organization.billing_customer_id,
            return_url=f"{base_url}/dashboard",
        )
        return portal_session.url

    # -- webhooks ----------------------------------------------------------

    def parse_webhook(self, payload: bytes, signature: str) -> BillingEvent:
        """Verify + parse a real Stripe webhook delivery.

        Only the four event types in `_STRIPE_EVENT_TYPE_MAP` are handled —
        the Stripe Dashboard webhook endpoint for this app must be
        subscribed to exactly those (docs §6). Any other, validly-signed
        event type raises `ValueError`, which `apply_webhook` turns into a
        400 — deliberately fail-loud rather than silently ignoring it, so a
        webhook-endpoint misconfiguration (subscribing to extra event
        types) is visible immediately via Stripe's dashboard delivery logs,
        instead of quietly never doing anything.
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, settings.stripe_webhook_secret
            )
        except stripe.error.SignatureVerificationError as exc:
            raise PermissionError(f"Invalid Stripe webhook signature: {exc}") from exc
        except ValueError as exc:
            raise ValueError(f"Malformed Stripe webhook payload: {exc}") from exc

        return _normalize_event(event)


# ---------------------------------------------------------------------------
# Event normalization — Stripe event -> provider-neutral BillingEvent
# ---------------------------------------------------------------------------


def _organization_id_from_metadata(obj: Any) -> Optional[int]:
    metadata = (obj.get("metadata") if obj is not None else None) or {}
    raw_id = metadata.get("organization_id")
    if raw_id is None:
        return None
    try:
        return int(raw_id)
    except (TypeError, ValueError):
        return None


def _period_end(subscription: Any) -> Optional[datetime]:
    # Stripe moved `current_period_end` from the Subscription object onto
    # each subscription item as of the 2025-03-31.basil API version (to
    # support multiple differently-billed items per subscription). Try the
    # legacy top-level field first, then the per-item field, so this works
    # against either API version.
    ts = subscription.get("current_period_end")
    if ts is None:
        items = (subscription.get("items") or {}).get("data") or []
        if items:
            ts = (items[0] or {}).get("current_period_end")
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def _plan_from_subscription(subscription: Any) -> Optional[str]:
    """Reverse-map the subscription's Stripe price ID to our `PlanTier`.

    Returns `None` (rather than raising) when the price ID doesn't match
    any of the four configured `STRIPE_PRICE_*` values — e.g. a manually
    created test-mode subscription on an unrelated price. `_apply_transition`
    in webhook_handler.py only overwrites `organization.plan` when the
    `"plan"` key is present in `raw` at all, so omitting it here leaves the
    plan untouched instead of guessing.
    """
    items = (subscription.get("items") or {}).get("data") or []
    if not items:
        return None
    price = (items[0] or {}).get("price") or {}
    price_id = price.get("id")
    if not price_id:
        return None
    for (plan, _interval), configured_price_id in _price_ids().items():
        if configured_price_id and configured_price_id == price_id:
            return plan.value
    return None


def _from_checkout_session(event: Any, session: Any) -> BillingEvent:
    org_id = None
    client_reference_id = session.get("client_reference_id")
    if client_reference_id is not None:
        try:
            org_id = int(client_reference_id)
        except (TypeError, ValueError):
            org_id = None
    if org_id is None:
        org_id = _organization_id_from_metadata(session)

    return BillingEvent(
        event_id=event["id"],
        type=BillingEventType.CHECKOUT_COMPLETED,
        organization_id=org_id,
        subscription_id=session.get("subscription"),
        customer_id=session.get("customer"),
        # Not resolvable from the Checkout Session object itself without an
        # extra Stripe API call to fetch the PaymentMethod — out of scope
        # here; `organization.payment_method_last4` simply stays whatever
        # it was (display-only field, docs §4).
        current_period_end=None,
        payment_method_last4=None,
        raw={},
    )


def _from_subscription(event: Any, subscription: Any, domain_type: BillingEventType) -> BillingEvent:
    raw: dict = {}
    if domain_type == BillingEventType.SUBSCRIPTION_UPDATED:
        status = subscription.get("status")
        raw["status"] = _STRIPE_STATUS_TO_DOMAIN.get(status, "past_due")
        plan_value = _plan_from_subscription(subscription)
        if plan_value:
            raw["plan"] = plan_value
        # Deliberately never set raw["trial_ends_at"] here — that key is a
        # dev/test-only extension of `_apply_transition` for the fake
        # provider's advance-trial tool (webhook_handler.py), gated off in
        # production. Real Stripe `customer.subscription.updated` events
        # must never influence `trial_ends_at` through this path.

    return BillingEvent(
        event_id=event["id"],
        type=domain_type,
        organization_id=_organization_id_from_metadata(subscription),
        subscription_id=subscription.get("id"),
        customer_id=subscription.get("customer"),
        current_period_end=_period_end(subscription) if domain_type == BillingEventType.SUBSCRIPTION_UPDATED else None,
        payment_method_last4=None,
        raw=raw,
    )


def _from_invoice(event: Any, invoice: Any) -> BillingEvent:
    # As of Stripe API 2022-11-15, `invoice.subscription_details.metadata`
    # is a snapshot of the subscription's metadata at invoice-creation
    # time — the same `organization_id` we set in `subscription_data.metadata`
    # at checkout (create_checkout_session above). No API call needed.
    subscription_details = invoice.get("subscription_details") or {}
    org_id = _organization_id_from_metadata(subscription_details)

    return BillingEvent(
        event_id=event["id"],
        type=BillingEventType.PAYMENT_FAILED,
        organization_id=org_id,
        subscription_id=invoice.get("subscription"),
        customer_id=invoice.get("customer"),
        current_period_end=None,
        payment_method_last4=None,
        raw={},
    )


def _normalize_event(event: Any) -> BillingEvent:
    stripe_type = event["type"]
    domain_type = _STRIPE_EVENT_TYPE_MAP.get(stripe_type)
    if domain_type is None:
        raise ValueError(f"Unhandled Stripe event type: {stripe_type!r}")

    obj = event["data"]["object"]

    if domain_type == BillingEventType.CHECKOUT_COMPLETED:
        return _from_checkout_session(event, obj)
    if domain_type in (BillingEventType.SUBSCRIPTION_UPDATED, BillingEventType.SUBSCRIPTION_DELETED):
        return _from_subscription(event, obj, domain_type)
    return _from_invoice(event, obj)
