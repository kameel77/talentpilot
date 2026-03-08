"""Add phone/linkedin_url to users and address to organizations

Revision ID: 3b7d2e1f4a9c
Revises: e9c1c0475460
Create Date: 2026-03-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '3b7d2e1f4a9c'
down_revision = 'e9c1c0475460'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('linkedin_url', sa.String(500), nullable=True))
    op.add_column('organizations', sa.Column('address', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'address')
    op.drop_column('users', 'linkedin_url')
    op.drop_column('users', 'phone')
