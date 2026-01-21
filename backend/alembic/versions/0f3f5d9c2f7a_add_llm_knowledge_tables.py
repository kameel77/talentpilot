"""add llm knowledge tables

Revision ID: 0f3f5d9c2f7a
Revises: 9f3c1e1b2c4a
Create Date: 2025-01-10 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = "0f3f5d9c2f7a"
down_revision = "9f3c1e1b2c4a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("key", name="uq_app_settings_key"),
    )

    op.create_table(
        "user_queries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_hash", sa.String(length=64), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="pl"),
        sa.Column("is_unique", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("matched_query_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["matched_query_id"], ["user_queries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_user_queries_question_hash", "user_queries", ["question_hash"])

    op.create_table(
        "knowledge_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="pl"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("source_query_id", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_query_id"], ["user_queries.id"], ondelete="SET NULL"),
    )

    # Definitive fix for duplicate Enum type: drop it if it exists before creation.
    # This is safe because the table using it (answer_reviews) is about to be created for the first time.
    op.execute("DROP TYPE IF EXISTS reviewstatus CASCADE")
    
    # Define the enum for use in create_table
    review_status = sa.Enum("pending", "approved", "rejected", name="reviewstatus")

    op.create_table(
        "generated_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("query_id", sa.Integer(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=200), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["query_id"], ["user_queries.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "answer_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("generated_answer_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("status", review_status, nullable=False, server_default="pending"),
        sa.Column("edited_text", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["generated_answer_id"], ["generated_answers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("generated_answer_id", name="uq_answer_reviews_generated_answer"),
    )


def downgrade() -> None:
    op.drop_table("answer_reviews")
    op.drop_table("generated_answers")
    op.drop_table("knowledge_items")
    op.drop_index("ix_user_queries_question_hash", table_name="user_queries")
    op.drop_table("user_queries")
    op.drop_table("app_settings")
    op.execute("DROP TYPE IF EXISTS reviewstatus")
