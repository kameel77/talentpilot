"""Add structured address fields to organizations (street, postal_code, city, tax_id)

Revision ID: h3c4d5e6f7g8
Revises: f49122346181
Create Date: 2026-04-25 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'h3c4d5e6f7g8'
down_revision = 'f49122346181'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {col["name"] for col in inspector.get_columns("organizations")}

    if "street" not in existing:
        op.add_column("organizations", sa.Column("street", sa.String(255), nullable=True))
    if "postal_code" not in existing:
        op.add_column("organizations", sa.Column("postal_code", sa.String(20), nullable=True))
    if "city" not in existing:
        op.add_column("organizations", sa.Column("city", sa.String(120), nullable=True))
    if "tax_id" not in existing:
        op.add_column("organizations", sa.Column("tax_id", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "tax_id")
    op.drop_column("organizations", "city")
    op.drop_column("organizations", "postal_code")
    op.drop_column("organizations", "street")
