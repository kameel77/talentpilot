"""Add OrganizationAccess and coach role

Revision ID: f49122346181
Revises: g2b3c4d5e6f7
Create Date: 2026-04-21 00:03:40.776249

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f49122346181'
down_revision = 'g2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres 12+ supports ALTER TYPE ... ADD VALUE inside a transaction block natively.
    # Alembic runs inside a global transaction block natively so we execute it normally without hacks.
    op.execute(
        "ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'coach';"
    )
    
    # Create organization_access table
    op.create_table(
        'organization_access',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('organization_access')
