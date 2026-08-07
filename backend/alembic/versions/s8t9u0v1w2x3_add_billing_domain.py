"""Add billing domain: plan/subscription columns on organizations + processed_billing_events

Phase 1 of docs/BRIEF_BILLING_TRIAL.md — provider-agnostic data model only.
No Stripe integration; `processed_billing_events` is created now (empty) so
Phase 2's webhook idempotency needs no migration of its own.

Existing organizations get plan=FREE, subscription_status=FREE via
server_default — no organization loses access on deploy.

Uses batch_alter_table so this migration is exercisable on SQLite (which
cannot ALTER TABLE ... ADD CONSTRAINT / DROP COLUMN in place) as well as on
Postgres, where batch mode transparently falls back to plain ALTER TABLE.

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = "s8t9u0v1w2x3"
down_revision = "r7s8t9u0v1w2"
branch_labels = None
depends_on = None


plan_tier_enum = sa.Enum("free", "pro", "studio", name="plantier")
subscription_status_enum = sa.Enum(
    "trialing", "active", "past_due", "canceled", "free", name="subscriptionstatus"
)


def upgrade():
    bind = op.get_bind()
    plan_tier_enum.create(bind, checkfirst=True)
    subscription_status_enum.create(bind, checkfirst=True)

    with op.batch_alter_table("organizations") as batch_op:
        batch_op.add_column(
            sa.Column("plan", plan_tier_enum, nullable=False, server_default="free")
        )
        batch_op.add_column(
            sa.Column(
                "subscription_status",
                subscription_status_enum,
                nullable=False,
                server_default="free",
            )
        )
        batch_op.add_column(sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("billing_customer_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("billing_subscription_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("payment_method_last4", sa.String(length=4), nullable=True))
        batch_op.create_unique_constraint(
            "uq_organizations_billing_customer_id", ["billing_customer_id"]
        )
        batch_op.create_unique_constraint(
            "uq_organizations_billing_subscription_id", ["billing_subscription_id"]
        )

    op.create_table(
        "processed_billing_events",
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        # sa.func.now() (not sa.text("now()")) so this renders correctly on
        # both Postgres (now()) and SQLite (CURRENT_TIMESTAMP) — several
        # older migrations in this repo hardcode sa.text("now()"), which is
        # Postgres-only and breaks a from-scratch SQLite replay.
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("event_id"),
    )


def downgrade():
    op.drop_table("processed_billing_events")

    with op.batch_alter_table("organizations") as batch_op:
        batch_op.drop_constraint("uq_organizations_billing_subscription_id", type_="unique")
        batch_op.drop_constraint("uq_organizations_billing_customer_id", type_="unique")
        batch_op.drop_column("payment_method_last4")
        batch_op.drop_column("billing_subscription_id")
        batch_op.drop_column("billing_customer_id")
        batch_op.drop_column("current_period_end")
        batch_op.drop_column("trial_ends_at")
        batch_op.drop_column("subscription_status")
        batch_op.drop_column("plan")

    bind = op.get_bind()
    subscription_status_enum.drop(bind, checkfirst=True)
    plan_tier_enum.drop(bind, checkfirst=True)
