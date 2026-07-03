"""Add is_workspace flag to organizations.

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
"""
from alembic import op
import sqlalchemy as sa

revision = "o9p0q1r2s3t4"
down_revision = "n8o9p0q1r2s3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organizations",
        sa.Column("is_workspace", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("organizations", "is_workspace")
