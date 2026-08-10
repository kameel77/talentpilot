"""Dev/staging/CI billing provider — no external network calls at all.

Used when `BILLING_PROVIDER=fake` (never allowed in production — see the
boot guard in `backend/config.py`). It exists to let checkout → webhook →
plan-limit flows be exercised end-to-end without Stripe.

The important constraint (docs/BRIEF_BILLING_TRIAL.md §3): this class must
NOT write subscription state to the database itself. It only produces
`CheckoutSession`/`BillingEvent` values and signed webhook payloads; the
actual state transitions happen in
`services/billing/webhook_handler.apply_webhook`, the exact same code path
a real Stripe webhook delivery would go through. A fake provider that
mutated `Organization` columns directly could pass its own tests while the
real webhook wiring was broken — see the module-level warning in the brief.
"""
import hashlib
import hmac
import json
import secrets
from datetime import datetime
from typing import Any, Optional

from config import settings

from .base import BillingEvent, BillingEventType, BillingProvider, CheckoutSession, PlanPrice


def _secret() -> str:
    if not settings.billing_webhook_secret:
        raise RuntimeError(
            "BILLING_WEBHOOK_SECRET must be set when BILLING_PROVIDER=fake — "
            "the fake provider signs synthetic webhooks with it, exercising "
            "the exact same HMAC verification path a real provider would."
        )
    return settings.billing_webhook_secret


def _sign(payload: bytes) -> str:
    return hmac.new(_secret().encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _verify_signature(payload: bytes, signature: Optional[str]) -> bool:
    if not signature:
        return False
    expected = _sign(payload)
    # constant-time compare — same requirement a real provider's signature
    # check has, exercised here rather than bypassed.
    return hmac.compare_digest(expected, signature)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


class FakeBillingProvider(BillingProvider):
    """Implements `BillingProvider` with synthetic, locally-signed events."""

    def create_checkout_session(self, organization, user, plan, interval: str = "monthly") -> CheckoutSession:
        # `interval` deliberately unused here — the fake provider has no
        # price catalog to resolve against (see base.py's docstring on why
        # this parameter exists at all). Accepted only so this stays a
        # valid, call-compatible `BillingProvider` implementation.
        session_id = f"fake_cs_{secrets.token_urlsafe(16)}"
        base_url = settings.frontend_url.rstrip("/")
        url = f"{base_url}/dev/checkout?session={session_id}&org={organization.id}"
        return CheckoutSession(url=url, session_id=session_id)

    def list_prices(self) -> list[PlanPrice]:
        """Synthetic catalogue so the pricing UI is exercisable locally.

        These amounts exist only in fake mode. Real amounts always come
        from the provider (`stripe_provider.list_prices`) and are never
        hardcoded for production use.
        """
        return [
            PlanPrice(plan="pro", interval="monthly", amount_minor=24900, currency="PLN"),
            PlanPrice(plan="pro", interval="yearly", amount_minor=249000, currency="PLN"),
            PlanPrice(plan="studio", interval="monthly", amount_minor=49900, currency="PLN"),
            PlanPrice(plan="studio", interval="yearly", amount_minor=499000, currency="PLN"),
        ]

    def cancel_subscription(self, organization) -> None:
        # No live subscription to reach out to in fake mode. Cancellation
        # in this phase is exercised through the dev simulation endpoints
        # (backend/routers/dev_billing.py: expire-subscription /
        # reset-to-free), which drive SUBSCRIPTION_DELETED through the
        # normal webhook handler instead. Nothing to do here.
        return None

    def get_portal_url(self, organization) -> str:
        base_url = settings.frontend_url.rstrip("/")
        return f"{base_url}/dev/checkout?org={organization.id}&portal=1"

    def parse_webhook(self, payload: bytes, signature: str) -> BillingEvent:
        if not _verify_signature(payload, signature):
            raise PermissionError("Invalid webhook signature")
        try:
            data = json.loads(payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"Malformed webhook payload: {exc}") from exc
        return self._event_from_dict(data)

    def build_dev_webhook(
        self, event_type: BillingEventType, organization_id: int, **fields: Any
    ) -> tuple[bytes, str]:
        event_id = fields.get("event_id") or f"evt_fake_{secrets.token_urlsafe(12)}"
        data = {
            "event_id": event_id,
            "type": BillingEventType(event_type).value,
            "organization_id": organization_id,
            "subscription_id": fields.get("subscription_id"),
            "customer_id": fields.get("customer_id"),
            "current_period_end": fields.get("current_period_end"),
            "payment_method_last4": fields.get("payment_method_last4"),
            # Extras read from BillingEvent.raw by webhook_handler — not
            # part of the shared dataclass, see base.py docstring.
            "plan": fields.get("plan"),
            "status": fields.get("status"),
            "trial_ends_at": fields.get("trial_ends_at"),
        }
        payload = json.dumps(data).encode("utf-8")
        return payload, _sign(payload)

    @staticmethod
    def _event_from_dict(data: dict) -> BillingEvent:
        return BillingEvent(
            event_id=data["event_id"],
            type=BillingEventType(data["type"]),
            organization_id=data.get("organization_id"),
            subscription_id=data.get("subscription_id"),
            customer_id=data.get("customer_id"),
            current_period_end=_parse_datetime(data.get("current_period_end")),
            payment_method_last4=data.get("payment_method_last4"),
            raw=data,
        )
