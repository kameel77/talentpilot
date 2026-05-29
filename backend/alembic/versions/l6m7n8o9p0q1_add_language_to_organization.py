"""Add language field to Organization model

Revision ID: l6m7n8o9p0q1
Revises: k5f6g7h8i9j0
Create Date: 2026-05-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l6m7n8o9p0q1'
down_revision: Union[str, None] = 'k5f6g7h8i9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'organizations' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('organizations')]
        if 'language' not in columns:
            op.add_column('organizations', sa.Column(
                'language', sa.String(10), nullable=False, server_default='pl'
            ))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'organizations' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('organizations')]
        if 'language' in columns:
            op.drop_column('organizations', 'language')
