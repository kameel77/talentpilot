"""Billing endpoints — checkout, portal, and the provider webhook.

docs/BRIEF_BILLING_TRIAL.md §5-6. This router only ever talks to
`get_billing_provider()` — never a concrete provider class directly.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth import check_org_access, get_current_user
from database import get_db
from models import Organization, User, UserRole
from config import settings
from schemas import (
    BillingCheckoutCallbackRequest,
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingPlanPrice,
    BillingPortalResponse,
    BillingStatusResponse,
)
from services.billing.base import BillingEventType
from services.billing.provider import get_billing_provider
from services.billing.trial import remaining_trial_days
from services.billing.webhook_handler import InvalidWebhookSignature, apply_webhook
from services.plan_limits import check_within_limit
from fastapi import Query

router = APIRouter()

_BILLING_DISABLED_DETAIL = "Billing is not enabled (BILLING_PROVIDER=disabled)"


@router.get("/check-limit")
def check_limit(
    resource: str = Query(..., pattern="^(profiles|client_orgs)$"),
    count: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fast pre-check endpoint to verify if caller can add `count` of a resource.
    
    Returns `{ allowed: bool, resource: str, limit: int | None, current: int, remaining: int | None, requested: int, plan: str | None }`
    """
    if current_user.role != UserRole.COACH or current_user.organization is None:
        return {"allowed": True, "resource": resource, "limit": None, "current": 0, "remaining": None, "requested": count}
    return check_within_limit(db, current_user.organization, resource, count=count)


@router.get("/status", response_model=BillingStatusResponse)
def get_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Plan, trial countdown and the purchasable plan catalogue.

    Deliberately answers even when billing is disabled: the trial lives on
    our own `Organization` row, so the countdown and the Free-tier limits
    are real regardless of whether a payment provider is configured.
    `enabled=False` tells the UI to hide checkout and portal actions
    instead of offering buttons that would 503.
    """
    organization = current_user.organization
    if organization is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no billing organization")

    provider = get_billing_provider()
    plans = [BillingPlanPrice(**vars(price)) for price in provider.list_prices()] if provider else []

    return BillingStatusResponse(
        enabled=provider is not None,
        plan=organization.plan,
        subscription_status=organization.subscription_status,
        trial_ends_at=organization.trial_ends_at,
        trial_days_left=remaining_trial_days(organization),
        require_card_at_signup=settings.billing_require_card_at_signup,
        payment_method_last4=organization.payment_method_last4,
        current_period_end=organization.current_period_end,
        plans=plans,
    )


@router.post("/checkout", response_model=BillingCheckoutResponse)
def create_checkout(
    payload: BillingCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a checkout session for the caller's billing organization.

    The billing organization is always the caller's own workspace org
    (`current_user.organization`) — see docs §4: subscriptions live on
    Organization, never on User.
    """
    provider = get_billing_provider()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_BILLING_DISABLED_DETAIL)

    organization = current_user.organization
    if organization is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no billing organization")

    session = provider.create_checkout_session(organization, current_user, payload.plan, payload.interval)
    return BillingCheckoutResponse(url=session.url, session_id=session.session_id)


@router.get("/portal", response_model=BillingPortalResponse)
def get_portal(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the billing-management portal URL for the caller's org."""
    provider = get_billing_provider()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_BILLING_DISABLED_DETAIL)

    organization = current_user.organization
    if organization is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no billing organization")

    return BillingPortalResponse(url=provider.get_portal_url(organization))


@router.post("/webhook")
async def billing_webhook(request: Request, db: Session = Depends(get_db)):
    """Provider webhook — the real state-machine entry point (docs §6).

    `disabled` → 404 (no provider to verify a signature against, so there
    is nothing meaningful to accept here — see docs §6 boot guard note in
    config.py). Invalid signature → 400 with zero DB writes: signature
    verification happens inside `apply_webhook` before any query runs.
    """
    provider = get_billing_provider()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    body = await request.body()
    signature = request.headers.get(provider.webhook_signature_header, "")

    try:
        return apply_webhook(provider, body, signature, db)
    except InvalidWebhookSignature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")


@router.post("/checkout/callback")
def checkout_callback(
    payload: BillingCheckoutCallbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dev-only bridge for the fake-provider checkout stub page.

    Real Stripe Checkout is hosted by Stripe; once the customer pays,
    Stripe calls our REAL webhook directly — the browser is never involved
    in that leg. The fake provider has no hosted page of its own, so
    `frontend/app/dev/checkout/page.tsx` calls this endpoint instead: the
    browser reports "the fake checkout finished" (paid or declined), and
    this endpoint plays Stripe's part — it builds+signs the exact same
    webhook payload shape a real delivery would use and runs it through
    the identical `apply_webhook` state machine. It never touches
    `Organization` columns directly (docs §3).

    Only works with `BILLING_PROVIDER=fake`:
    `provider.build_dev_webhook` raises `NotImplementedError` for any
    other provider (base.py), which this endpoint turns into 404 — so it
    is inert wherever billing is disabled (including production, where
    `disabled` is the supported state).
    """
    provider = get_billing_provider()
    if provider is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_BILLING_DISABLED_DETAIL)

    organization = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    if not check_org_access(db, current_user, organization.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this organization")

    event_type = (
        BillingEventType.CHECKOUT_COMPLETED
        if payload.outcome == "success"
        else BillingEventType.PAYMENT_FAILED
    )

    try:
        body, signature = provider.build_dev_webhook(
            event_type,
            organization.id,
            customer_id=f"fake_cus_{organization.id}",
            subscription_id=f"fake_sub_{payload.session_id}",
            payment_method_last4="4242",
        )
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checkout simulation is only available with BILLING_PROVIDER=fake",
        )

    try:
        return apply_webhook(provider, body, signature, db)
    except InvalidWebhookSignature:
        # Unreachable in practice — build_dev_webhook signs with the same
        # secret parse_webhook verifies against — but 400 keeps this
        # endpoint's failure modes consistent with the real webhook.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")
