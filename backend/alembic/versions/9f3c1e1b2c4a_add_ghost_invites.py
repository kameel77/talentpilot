"""Add ghost user fields and team invitations.

Revision ID: 9f3c1e1b2c4a
Revises: 1b6f0c1c7bde
Create Date: 2025-02-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f3c1e1b2c4a"
down_revision = "1b6f0c1c7bde"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("job_title", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("is_ghost", sa.Boolean(), nullable=True))
    op.execute("UPDATE users SET is_ghost = FALSE WHERE is_ghost IS NULL")
    op.alter_column("users", "is_ghost", nullable=False, server_default=sa.text("false"))

    op.create_table(
        "team_invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.Enum("active", "revoked", "expired", name="invitationstatus"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_team_invitations_id"), "team_invitations", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_team_invitations_id"), table_name="team_invitations")
    op.drop_table("team_invitations")
    op.drop_column("users", "is_ghost")
    op.drop_column("users", "job_title")
    op.execute("DROP TYPE IF EXISTS invitationstatus")
