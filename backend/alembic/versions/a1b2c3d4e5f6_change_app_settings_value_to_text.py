"""change app_settings value to text

Revision ID: a1b2c3d4e5f6
Revises: 6a8276f5a34e
Create Date: 2026-03-19 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "6a8276f5a34e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "app_settings",
        "value",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "app_settings",
        "value",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=False,
    )
