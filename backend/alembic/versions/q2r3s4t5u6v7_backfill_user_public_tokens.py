"""Backfill user public tokens for existing ghost users

Revision ID: q2r3s4t5u6v7
Revises: p0q1r2s3t4u5
Create Date: 2026-08-07

"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "q2r3s4t5u6v7"
down_revision = "p0q1r2s3t4u5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    users_table = sa.Table(
        "users",
        sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("public_token", sa.String(64)),
    )

    rows = bind.execute(sa.select(users_table.c.id).where(users_table.c.public_token.is_(None))).fetchall()
    for row in rows:
        token = str(uuid.uuid4()).replace("-", "")
        bind.execute(
            users_table.update().where(users_table.c.id == row.id).values(public_token=token)
        )


def downgrade():
    # Intentional no-op: backfilled tokens are non-destructive and preserved during rollback.
    pass
