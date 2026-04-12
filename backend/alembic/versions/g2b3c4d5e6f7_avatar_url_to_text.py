"""change avatar_url from varchar(500) to text

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-12 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'g2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('users', 'avatar_url',
                    existing_type=sa.String(500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'avatar_url',
                    existing_type=sa.Text(),
                    type_=sa.String(500),
                    existing_nullable=True)
