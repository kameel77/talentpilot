"""Add presentation link metadata to teams table.

docs/superpowers/specs/2026-09-15-public-team-matrix-link-design.md
Adds presentation_anonymized (Boolean, not null, default false) and
presentation_created_at (DateTime with timezone, nullable) to teams.

Revision ID: b2c3d4e5f6a7
Revises: y4z5a6b7c8d9
Create Date: 2026-09-15

"""
from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a7"
down_revision = "y4z5a6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "teams",
        sa.Column(
            "presentation_anonymized",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "teams",
        sa.Column(
            "presentation_created_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("teams", "presentation_created_at")
    op.drop_column("teams", "presentation_anonymized")
