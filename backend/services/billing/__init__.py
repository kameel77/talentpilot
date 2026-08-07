"""Billing provider abstraction (docs/BRIEF_BILLING_TRIAL.md §5).

Routers and domain code must import only `get_billing_provider` from
`services.billing.provider` — never a concrete provider class. That is the
one seam Phase 2 (Stripe) needs to land through: a new
`services/billing/stripe_provider.py` plus a branch in `provider.py`, with
zero changes anywhere else.
"""
