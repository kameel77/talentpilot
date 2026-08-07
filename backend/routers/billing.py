"""Billing endpoints — checkout, portal, and the provider webhook.

docs/BRIEF_BILLING_TRIAL.md §5-6. This router only ever talks to
`get_billing_provider()` — never a concrete provider class directly.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from auth import check_org_access, get_current_user
from database import get_db
from models import Organization, User
from schemas import (
    BillingCheckoutCallbackRequest,
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingPortalResponse,
)
from services.billing.base import BillingEventType
from services.billing.provider import get_billing_provider
from services.billing.webhook_handler import InvalidWebhookSignature, apply_webhook

router = APIRouter()

_BILLING_DISABLED_DETAIL = "Billing is not enabled (BILLING_PROVIDER=disabled)"


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

    session = provider.create_checkout_session(organization, current_user, payload.plan)
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
