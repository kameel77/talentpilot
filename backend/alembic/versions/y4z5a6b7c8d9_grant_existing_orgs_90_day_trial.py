"""Grant existing coach workspace organizations a 90-day trial.

docs/BRIEF_BILLING_TRIAL.md §6 design-partner intent + Phase 2b task brief
§C. Migration s8t9u0v1w2x3 added the billing columns with
`plan=free`, `subscription_status=free` on every existing row. The moment
`BILLING_PROVIDER=stripe` goes live and `services/plan_limits.py`'s Free
limits (1 client org / 5 profiles) start being enforced on write paths,
every coach who was already using the product would hit an HTTP 402 the
next time they added a client — a production incident triggered purely by
this migration chain reaching prod, not by any billing decision. This
migration grants a one-time 90-day trial to organizations that already
existed before billing did, so `plan_limits.assert_within_limit` treats
them as unlimited (see `_is_trial_active`) until the trial runs out.

Scope: coach workspaces only (`organizations.is_workspace = true`). Client
organizations (`is_workspace = false`) never carry their own subscription
(docs §4 — billing lives on the coach's workspace org) so touching them
would be a no-op at best.

Bounded + idempotent (task brief §C): only rows matching
`is_workspace = true AND subscription_status = 'free' AND
trial_ends_at IS NULL` are updated. Any organization created — or that has
already moved off that exact free/no-trial state — after this migration
first runs no longer matches, so re-running the migration (or replaying it
on a second deploy of the same image) is a no-op rather than extending
anyone's trial again.

The 90-day cutoff is computed once in Python
(`datetime.now(timezone.utc) + timedelta(days=90)`) and bound as a literal
value — NOT as `sa.func.now() + <interval>`. `sa.func.now()` alone compiles
fine on both Postgres and SQLite (the reason the existing
`s8t9u0v1w2x3_add_billing_domain.py` migration uses it for a
`server_default`), but "now + 90 days" date arithmetic has no portable
SQLAlchemy Core spelling across the two dialects (SQLite has no INTERVAL
type). A plain Python-computed literal, bound as an ordinary parameter,
sidesteps that entirely — this migration runs exactly once per
organization, at deploy time, so "90 days from when the migration process
computed the value" and "90 days from when the UPDATE executes on the DB
server" differ by, at most, network latency. This is NOT the
`sa.text("now()")` anti-pattern the task brief warns about (that renders
Postgres-only SQL text); no raw SQL string is used here at all.

downgrade() reverts rows matching `is_workspace = true AND
subscription_status = 'trialing' AND billing_customer_id IS NULL`. The
`billing_customer_id IS NULL` condition is what distinguishes a trial
granted BY THIS MIGRATION from a genuine trial started by a real customer
completing Stripe Checkout after this migration ran — the CHECKOUT_COMPLETED
branch of `services/billing/webhook_handler.py::_apply_transition` is what
sets `billing_customer_id`, and this migration never does. Caveat: an
organization whose 90-day (or any) trial was instead granted manually via
the admin panel (docs §8) also lacks a `billing_customer_id` and would be
reverted too if still `trialing` when downgrade runs. `downgrade()` here is
meant as an immediate-rollback safety net for this specific deploy, not a
general "undo every ungated trial" tool — if that distinction ever matters
in practice, it needs its own tracking column, not a downgrade heuristic.

Revision ID: y4z5a6b7c8d9
Revises: s8t9u0v1w2x3
Create Date: 2026-08-10

"""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op

revision = "y4z5a6b7c8d9"
down_revision = "s8t9u0v1w2x3"
branch_labels = None
depends_on = None


TRIAL_DAYS = 90

# Lightweight, migration-local table reference (not the ORM model) — the
# standard Alembic pattern for data migrations, so this file keeps working
# even if `models.Organization` changes shape in the future.
organizations = sa.table(
    "organizations",
    sa.column("id", sa.Integer),
    sa.column("is_workspace", sa.Boolean),
    sa.column("subscription_status", sa.String),
    sa.column("trial_ends_at", sa.DateTime(timezone=True)),
    sa.column("billing_customer_id", sa.String),
)


def upgrade():
    bind = op.get_bind()
    trial_ends_at = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)

    bind.execute(
        organizations.update()
        .where(organizations.c.is_workspace.is_(True))
        .where(organizations.c.subscription_status == "free")
        .where(organizations.c.trial_ends_at.is_(None))
        .values(subscription_status="trialing", trial_ends_at=trial_ends_at)
    )


def downgrade():
    bind = op.get_bind()

    bind.execute(
        organizations.update()
        .where(organizations.c.is_workspace.is_(True))
        .where(organizations.c.subscription_status == "trialing")
        .where(organizations.c.billing_customer_id.is_(None))
        .values(subscription_status="free", trial_ends_at=None)
    )
