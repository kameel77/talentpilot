"""add user feedback table

Revision ID: 2a8b3c4d5e6f
Revises: 0f3f5d9c2f7a
Create Date: 2026-01-21 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2a8b3c4d5e6f"
down_revision = "7f1b9c2a4d8e"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "user_feedbacks",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("query_id", sa.Integer(), sa.ForeignKey("user_queries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("answer_id", sa.Integer(), sa.ForeignKey("generated_answers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("is_effective", sa.Boolean(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("user_feedbacks")
