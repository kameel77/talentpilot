"""Add order_number to talents.

Revision ID: 7c4f9b4b3d8d
Revises: 484416743171
Create Date: 2025-02-14 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7c4f9b4b3d8d"
down_revision = "484416743171"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("talents", sa.Column("order_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("talents", "order_number")
