"""Make team_invitations.team_id nullable for individual-client invitations.

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
"""
from alembic import op
import sqlalchemy as sa

revision = "n8o9p0q1r2s3"
down_revision = "m7n8o9p0q1r2"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "team_invitations", "team_id",
        existing_type=sa.Integer(), nullable=True,
    )


def downgrade():
    op.alter_column(
        "team_invitations", "team_id",
        existing_type=sa.Integer(), nullable=False,
    )
