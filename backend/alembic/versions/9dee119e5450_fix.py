"""ghost migration to unblock alembic

Revision ID: 9dee119e5450
Revises: None
Create Date: 2026-04-25 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9dee119e5450'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
