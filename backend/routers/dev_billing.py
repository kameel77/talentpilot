"""Dev-only billing simulation endpoints (docs/BRIEF_BILLING_TRIAL.md §5).

NEVER registered in production. `main.py` only calls
`app.include_router(dev_billing.router, ...)` inside an
`if settings.environment != "production":` block — this module is not even
imported by the running process otherwise, not merely feature-flagged at
runtime. If you're looking for why a route here 404s in prod, that's why.

Every action drives the SAME webhook state machine
(`services.billing.webhook_handler.apply_webhook`) that the real
`POST /api/billing/webhook` endpoint uses — never writes to `Organization`
columns directly, so a bug in these tools can't silently diverge from
production behavior. All actions target an arbitrary `organization_id`
(not just the caller's own org), so all of them require admin.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import require_role
from database import get_db
from models import Organization
from schemas import DevBillingActionRequest
from services.billing.base import BillingEventType
from services.billing.provider import get_billing_provider
from services.billing.webhook_handler import InvalidWebhookSignature, apply_webhook

router = APIRouter()


def _get_org_or_404(db: Session, organization_id: int) -> Organization:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


def _emit(db: Session, event_type: BillingEventType, organization: Organization, **fields) -> dict:
    provider = get_billing_provider()
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not enabled (BILLING_PROVIDER=disabled)",
        )
    payload, signature = provider.build_dev_webhook(event_type, organization.id, **fields)
    try:
        return apply_webhook(provider, payload, signature, db)
    except InvalidWebhookSignature as exc:
        # Unreachable in practice (see routers/billing.py::checkout_callback
        # for the identical note) — surfaced as 400 for consistency.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/advance-trial")
def advance_trial(
    payload: DevBillingActionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Move `trial_ends_at` into the past so plan limits re-apply immediately.

    Emitted as a SUBSCRIPTION_UPDATED event carrying a `trial_ends_at`
    override in `raw` — a dev/test-only extension that
    `webhook_handler._apply_transition` reads (see its docstring); real
    Stripe `subscription.updated` events never populate that key, so this
    has no effect on real webhook handling.
    """
    organization = _get_org_or_404(db, payload.organization_id)
    past = datetime.now(timezone.utc) - timedelta(days=1)
    return _emit(
        db,
        BillingEventType.SUBSCRIPTION_UPDATED,
        organization,
        trial_ends_at=past.isoformat(),
    )


@router.post("/simulate-payment-failure")
def simulate_payment_failure(
    payload: DevBillingActionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Emit PAYMENT_FAILED — mirrors a real `invoice.payment_failed` event."""
    organization = _get_org_or_404(db, payload.organization_id)
    return _emit(db, BillingEventType.PAYMENT_FAILED, organization)


@router.post("/expire-subscription")
def expire_subscription(
    payload: DevBillingActionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Emit SUBSCRIPTION_DELETED — mirrors dunning exhausting its retries."""
    organization = _get_org_or_404(db, payload.organization_id)
    return _emit(db, BillingEventType.SUBSCRIPTION_DELETED, organization)


@router.post("/reset-to-free")
def reset_to_free(
    payload: DevBillingActionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Emit SUBSCRIPTION_DELETED — explicit admin reset for test fixtures.

    Same transition as expire-subscription; kept as a separate, clearly-named
    action because the two represent different testing intents (organic
    cancellation vs. "put this org back to a clean Free state").
    """
    organization = _get_org_or_404(db, payload.organization_id)
    return _emit(db, BillingEventType.SUBSCRIPTION_DELETED, organization)
