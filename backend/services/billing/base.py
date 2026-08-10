"""Provider-neutral billing interface (docs/BRIEF_BILLING_TRIAL.md §5).

`BillingProvider` is the only seam between our domain code and a payment
provider. No router or service outside `services/billing/` may reference a
concrete provider (Stripe, the fake, or anything else) — they go through
`services.billing.provider.get_billing_provider()` and talk to whatever it
returns purely through this interface.

`CheckoutSession` and `BillingEvent` are deliberately thin and
provider-agnostic: just the fields our state machine
(`services/billing/webhook_handler.py`) actually needs. Anything
provider-specific rides along in `BillingEvent.raw` instead of growing the
shared dataclass.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, ClassVar, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from models import Organization, PlanTier, User


class BillingEventType(str, Enum):
    """Normalized webhook event types (docs/BRIEF_BILLING_TRIAL.md §6).

    Stored as the lowercase `.value` in synthetic (fake-provider) payloads,
    mirroring the `PlanTier`/`SubscriptionStatus` convention in models.py.
    A real Stripe adapter would map Stripe's own event names
    (`checkout.session.completed`, `customer.subscription.updated`, ...)
    onto these four when it lands.
    """

    CHECKOUT_COMPLETED = "checkout_completed"
    SUBSCRIPTION_UPDATED = "subscription_updated"
    SUBSCRIPTION_DELETED = "subscription_deleted"
    PAYMENT_FAILED = "payment_failed"


@dataclass(frozen=True)
class CheckoutSession:
    """Result of `BillingProvider.create_checkout_session`."""

    url: str
    session_id: str


@dataclass(frozen=True)
class PlanPrice:
    """One purchasable plan/interval combination, priced by the provider.

    Amounts are never hardcoded in this codebase (docs §6) — they are read
    back from the provider so the app can only ever display what a customer
    would actually be charged.
    """

    plan: str
    interval: str
    amount_minor: int
    currency: str


@dataclass(frozen=True)
class BillingEvent:
    """Normalized webhook event, already verified and parsed.

    `raw` carries the full provider-specific payload (dict) for anything
    not promoted to a first-class field — e.g. the fake provider's
    `plan`/`status`/`trial_ends_at` extras consumed by
    `webhook_handler._apply_transition`. Real Stripe events would carry
    their raw JSON here too.
    """

    event_id: str
    type: BillingEventType
    organization_id: Optional[int]
    subscription_id: Optional[str]
    customer_id: Optional[str]
    current_period_end: Optional[datetime]
    payment_method_last4: Optional[str]
    raw: dict = field(default_factory=dict)


class BillingProvider(ABC):
    """Narrow interface every payment provider adapter implements.

    See docs/BRIEF_BILLING_TRIAL.md §5: "Routery i logika domenowa nie
    importują `stripe` bezpośrednio" — the same rule applies to any
    concrete provider class, including the fake one.
    """

    #: HTTP header carrying the webhook signature, read by
    #: `routers/billing.py` before calling `parse_webhook`. A real Stripe
    #: adapter would override this to `"Stripe-Signature"`; kept on the
    #: provider (not hardcoded in the router) so the router never needs to
    #: know which concrete provider it's talking to.
    webhook_signature_header: ClassVar[str] = "X-Billing-Signature"

    @abstractmethod
    def create_checkout_session(
        self,
        organization: "Organization",
        user: "User",
        plan: "PlanTier",
        interval: str = "monthly",
    ) -> CheckoutSession:
        """Start a hosted checkout for `organization` onto `plan`.

        `interval` is `"monthly"` or `"yearly"` (default `"monthly"`,
        matching every call site that predates yearly pricing — see
        Phase 2b task brief §A). Added as an optional, defaulted parameter
        rather than a new required one specifically so this stays a
        backward-compatible interface change: every existing caller and
        every existing concrete implementation (`FakeBillingProvider`)
        keeps working unmodified in behavior when it doesn't pass/use
        `interval`. Only `StripeBillingProvider` actually branches on it,
        to resolve one of four configured Stripe price IDs
        (`backend/config.py`: `stripe_price_{pro,studio}_{monthly,yearly}`).
        """
        raise NotImplementedError

    @abstractmethod
    def cancel_subscription(self, organization: "Organization") -> None:
        """Cancel `organization`'s active subscription with the provider."""
        raise NotImplementedError

    def list_prices(self) -> list[PlanPrice]:
        """Configured, purchasable plans with their live amounts.

        Not abstract on purpose: a provider that cannot enumerate prices
        returns nothing and the pricing UI simply shows no plans, rather
        than every adapter being forced to grow a method it has no
        meaningful answer for.
        """
        return []

    @abstractmethod
    def get_portal_url(self, organization: "Organization") -> str:
        """URL for `organization` to manage its subscription/payment method."""
        raise NotImplementedError

    @abstractmethod
    def parse_webhook(self, payload: bytes, signature: str) -> BillingEvent:
        """Verify `signature` over the raw `payload` and return the event.

        Must raise (ValueError or PermissionError) on a bad/missing
        signature or a malformed payload — callers
        (`services/billing/webhook_handler.py`) treat any exception here as
        "reject with 400, write nothing to the DB".
        """
        raise NotImplementedError

    def build_dev_webhook(
        self, event_type: BillingEventType, organization_id: int, **fields: Any
    ) -> tuple[bytes, str]:
        """Build + sign a synthetic webhook payload for dev/test tooling.

        Deliberately NOT abstract: this is a fake-provider-only capability
        (see `FakeBillingProvider.build_dev_webhook`), not part of the core
        contract every provider must satisfy. A real provider has no way to
        fabricate a webhook — Stripe's own test tooling (CLI / test clocks)
        covers that instead — so the base implementation raises.

        `backend/routers/dev_billing.py` and the checkout callback in
        `backend/routers/billing.py` call this through
        `get_billing_provider()` only, never by importing
        `FakeBillingProvider` directly — that keeps "routers only use the
        factory" true even for dev-only tooling.
        """
        raise NotImplementedError(
            f"{type(self).__name__} does not support synthetic webhook "
            "simulation — this is a fake-provider-only dev/test capability."
        )
