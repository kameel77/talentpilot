"""Add talent translations and code column.

Revision ID: 1b6f0c1c7bde
Revises: 484416743171
Create Date: 2025-01-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "1b6f0c1c7bde"
down_revision = "484416743171"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("talents", sa.Column("code", sa.String(length=100), nullable=True))

    op.create_table(
        "talent_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("talent_id", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("short_description", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["talent_id"], ["talents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("talent_id", "language", name="uq_talent_translation_language"),
    )
    op.create_index(op.f("ix_talent_translations_id"), "talent_translations", ["id"], unique=False)

    op.execute(
        """
        UPDATE talents
        SET code = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
        WHERE code IS NULL;
        """
    )

    op.execute(
        """
        INSERT INTO talent_translations (talent_id, language, name, short_description, description)
        SELECT id, 'en', name, short_description, description
        FROM talents
        WHERE name IS NOT NULL;
        """
    )

    op.drop_constraint("talents_name_key", "talents", type_="unique")
    op.drop_column("talents", "name")
    op.drop_column("talents", "short_description")
    op.drop_column("talents", "description")

    op.alter_column("talents", "code", nullable=False)
    op.create_unique_constraint("uq_talents_code", "talents", ["code"])


def downgrade():
    op.drop_constraint("uq_talents_code", "talents", type_="unique")
    op.alter_column("talents", "code", nullable=True)

    op.add_column("talents", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("talents", sa.Column("short_description", sa.String(length=500), nullable=True))
    op.add_column("talents", sa.Column("name", sa.String(length=100), nullable=True))
    op.create_unique_constraint("talents_name_key", "talents", ["name"])

    op.execute(
        """
        UPDATE talents
        SET name = tt.name,
            short_description = tt.short_description,
            description = tt.description
        FROM talent_translations tt
        WHERE tt.talent_id = talents.id
          AND tt.language = 'en';
        """
    )

    op.drop_index(op.f("ix_talent_translations_id"), table_name="talent_translations")
    op.drop_table("talent_translations")
    op.drop_column("talents", "code")
