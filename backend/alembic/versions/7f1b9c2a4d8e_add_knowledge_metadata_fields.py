"""add knowledge metadata fields

Revision ID: 7f1b9c2a4d8e
Revises: 0f3f5d9c2f7a
Create Date: 2025-03-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7f1b9c2a4d8e"
down_revision = "0f3f5d9c2f7a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_items",
        sa.Column("title", sa.String(length=200), nullable=False, server_default="Wpis bez tytułu"),
    )
    op.add_column(
        "knowledge_items",
        sa.Column("category", sa.String(length=120), nullable=False, server_default="Ogólne"),
    )
    op.add_column(
        "knowledge_items",
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "knowledge_items",
        sa.Column("section", sa.String(length=40), nullable=False, server_default="merytoryka"),
    )
    op.add_column(
        "knowledge_items",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_items", "updated_at")
    op.drop_column("knowledge_items", "section")
    op.drop_column("knowledge_items", "tags")
    op.drop_column("knowledge_items", "category")
    op.drop_column("knowledge_items", "title")
