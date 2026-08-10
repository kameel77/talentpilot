"""The billing webhook state machine (docs/BRIEF_BILLING_TRIAL.md §6).

`apply_webhook` is the single place that turns a verified `BillingEvent`
into `Organization` column changes. It is called from two places, on
purpose:

- `POST /api/billing/webhook` (`routers/billing.py`) — the real endpoint a
  payment provider would call.
- The dev simulation tooling (`routers/dev_billing.py`, and the fake
  checkout stub's callback in `routers/billing.py`) — which must never
  patch `Organization` columns directly (docs §3/§5). They build a signed
  synthetic event via `provider.build_dev_webhook(...)` and run it through
  this exact function instead, so a bug here shows up identically whether
  it was triggered by a real webhook or a dev tool.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from config import settings
from models import Organization, PlanTier, ProcessedBillingEvent, SubscriptionStatus

from .base import BillingEvent, BillingEventType, BillingProvider


class InvalidWebhookSignature(Exception):
    """Raised for a bad signature OR a malformed payload.

    Either way, `provider.parse_webhook` raised before any DB access
    happened here — callers translate this into HTTP 400 with zero DB
    writes (docs/BRIEF_BILLING_TRIAL.md §8 DoD item 5).
    """


def apply_webhook(provider: BillingProvider, payload: bytes, signature: str, db: Session) -> dict:
    """Verify, de-duplicate, and apply one webhook delivery.

    Idempotent: a second delivery of the same `event_id` is a no-op that
    still returns 200 (never re-applies, never raises). The state mutation
    and the `processed_billing_events` insert happen in the same
    transaction — either both land or neither does.
    """
    try:
        event = provider.parse_webhook(payload, signature)
    except (ValueError, PermissionError) as exc:
        raise InvalidWebhookSignature(str(exc)) from exc

    already_processed = (
        db.query(ProcessedBillingEvent)
        .filter(ProcessedBillingEvent.event_id == event.event_id)
        .first()
    )
    if already_processed is not None:
        return {"status": "already_processed", "event_id": event.event_id}

    organization = None
    if event.organization_id is not None:
        organization = (
            db.query(Organization)
            .filter(Organization.id == event.organization_id)
            .first()
        )

    try:
        if organization is not None:
            _apply_transition(organization, event)
        # Recorded even when the organization wasn't found, so a webhook
        # for an unknown/deleted org doesn't get retried forever by the
        # provider — there's nothing more we could do with a retry.
        db.add(ProcessedBillingEvent(event_id=event.event_id, provider=settings.billing_provider))
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "status": "ok",
        "event_id": event.event_id,
        "type": event.type.value,
        "organization_found": organization is not None,
    }


def _apply_transition(organization: Organization, event: BillingEvent) -> None:
    """Mutate `organization` in place per docs/BRIEF_BILLING_TRIAL.md §6.

    Never touches any User/Team/OrganizationAccess row — reads are never
    limited by billing state (§8), so downgrades/cancellations must not
    delete or hide anything, only flip the two plan/status columns.
    """
    raw = event.raw or {}

    if event.type == BillingEventType.CHECKOUT_COMPLETED:
        if event.customer_id:
            organization.billing_customer_id = event.customer_id
        if event.subscription_id:
            organization.billing_subscription_id = event.subscription_id
        if event.payment_method_last4:
            organization.payment_method_last4 = event.payment_method_last4
        organization.subscription_status = SubscriptionStatus.TRIALING
        # A trial already on the row — granted at registration (docs §3) or
        # manually for a design partner (admin override, §8) — must never
        # be shortened by a real checkout. Only set when unset, which today
        # means organizations created before the product-led trial existed
        # or provisioned through the external API.
        if organization.trial_ends_at is None:
            organization.trial_ends_at = datetime.now(timezone.utc) + timedelta(
                days=settings.billing_trial_days_default
            )

    elif event.type == BillingEventType.SUBSCRIPTION_UPDATED:
        plan_value = raw.get("plan")
        if plan_value:
            organization.plan = PlanTier(plan_value)
        status_value = raw.get("status")
        if status_value:
            organization.subscription_status = SubscriptionStatus(status_value)
        if event.current_period_end is not None:
            organization.current_period_end = event.current_period_end
        # Dev/test-only extension — NOT part of the real Stripe
        # `customer.subscription.updated` shape (Stripe events never carry
        # this key, so production behavior is unaffected either way). It
        # exists purely so `routers/dev_billing.py`'s advance-trial tool
        # can fast-forward `trial_ends_at` through this SAME handler
        # instead of writing to the DB directly (docs §5).
        #
        # Explicitly gated on `environment != "production"` (Phase 2b task
        # brief §A), on top of `raw["trial_ends_at"]` never being emitted
        # by `StripeBillingProvider.parse_webhook` in the first place. That
        # emission-side omission is already sufficient in a correctly
        # configured deployment, but this is a signed-payload code path —
        # defense in depth belongs here too: without this gate, anyone able
        # to produce a validly-signed webhook payload carrying this key
        # (e.g. `routers/dev_billing.py` if it were ever mistakenly wired
        # up in production, or a future provider bug) could extend any
        # organization's trial arbitrarily. `routers/dev_billing.py` itself
        # is never registered in production (main.py), so this branch is
        # simply dead code there today — the gate just makes that
        # inaccessibility structural instead of incidental.
        if settings.environment != "production":
            trial_ends_at_value = raw.get("trial_ends_at")
            if trial_ends_at_value:
                organization.trial_ends_at = _parse_datetime(trial_ends_at_value)

    elif event.type == BillingEventType.SUBSCRIPTION_DELETED:
        organization.plan = PlanTier.FREE
        organization.subscription_status = SubscriptionStatus.FREE

    elif event.type == BillingEventType.PAYMENT_FAILED:
        organization.subscription_status = SubscriptionStatus.PAST_DUE


def _parse_datetime(value) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)
