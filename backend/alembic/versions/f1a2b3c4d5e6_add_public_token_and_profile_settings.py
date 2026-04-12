"""add public_token and public_profile_settings to users

Revision ID: f1a2b3c4d5e6
Revises: e9c1c0475460
Create Date: 2026-04-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('public_token', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('public_slug', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('public_profile_settings', sa.JSON(), nullable=True))
    op.create_index(op.f('ix_users_public_token'), 'users', ['public_token'], unique=True)
    op.create_index(op.f('ix_users_public_slug'), 'users', ['public_slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_public_slug'), table_name='users')
    op.drop_index(op.f('ix_users_public_token'), table_name='users')
    op.drop_column('users', 'public_profile_settings')
    op.drop_column('users', 'public_slug')
    op.drop_column('users', 'public_token')
