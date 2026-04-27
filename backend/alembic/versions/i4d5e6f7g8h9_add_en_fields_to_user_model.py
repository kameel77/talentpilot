"""Add EN fields to User model

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7g8
Create Date: 2026-04-27 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4d5e6f7g8h9'
down_revision: Union[str, None] = 'dd87278924a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    
    if 'users' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'superpowers_en' not in columns:
            op.add_column('users', sa.Column('superpowers_en', sa.Text(), nullable=True))
        if 'motivators_en' not in columns:
            op.add_column('users', sa.Column('motivators_en', sa.Text(), nullable=True))
        if 'blockers_en' not in columns:
            op.add_column('users', sa.Column('blockers_en', sa.Text(), nullable=True))
        if 'feedback_style_en' not in columns:
            op.add_column('users', sa.Column('feedback_style_en', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'feedback_style_en')
    op.drop_column('users', 'blockers_en')
    op.drop_column('users', 'motivators_en')
    op.drop_column('users', 'superpowers_en')
