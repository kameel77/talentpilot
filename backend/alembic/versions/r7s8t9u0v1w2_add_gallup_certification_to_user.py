"""Add Gallup certification fields to users

Revision ID: r7s8t9u0v1w2
Revises: q2r3s4t5u6v7
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa

revision = "r7s8t9u0v1w2"
down_revision = "q2r3s4t5u6v7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("gallup_certified", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("gallup_profile_url", sa.String(500), nullable=True),
    )


def downgrade():
    op.drop_column("users", "gallup_profile_url")
    op.drop_column("users", "gallup_certified")
