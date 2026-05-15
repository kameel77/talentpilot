"""Add presentation_token to teams + organization_access/password_reset_tokens cleanup

Revision ID: dd87278924a7
Revises: h3c4d5e6f7g8
Create Date: 2026-04-26 12:33:29.005423

History note: this revision bundles three unrelated changes that were
auto-generated together. It cannot be split because it is already applied
on production with this exact revision id. The upgrade() body has been
rewritten to be idempotent via SQLAlchemy inspector checks (instead of the
previous naked `try/except Exception: pass` blocks that swallowed real
errors) so it is safe to re-run against partially-applied schemas.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'dd87278924a7'
down_revision = 'h3c4d5e6f7g8'
branch_labels = None
depends_on = None


# Resource names kept as module-level constants so upgrade/downgrade stay in sync.
ORG_ACCESS_TABLE = 'organization_access'
ORG_ACCESS_UNIQUE = 'uq_organization_access'
PRT_TABLE = 'password_reset_tokens'
PRT_FK = 'password_reset_tokens_user_id_fkey'
TEAMS_TABLE = 'teams'
TEAMS_TOKEN_INDEX = 'ix_teams_presentation_token'


def _columns(inspector, table):
    return {c['name'] for c in inspector.get_columns(table)}


def _unique_names(inspector, table):
    return {uc['name'] for uc in inspector.get_unique_constraints(table)}


def _index_names(inspector, table):
    return {ix['name'] for ix in inspector.get_indexes(table)}


def _fk_delete_rule(conn, constraint_name):
    """Return 'CASCADE' / 'NO ACTION' / 'SET NULL' / ... or None when the FK is absent."""
    return conn.execute(
        text(
            "SELECT delete_rule FROM information_schema.referential_constraints "
            "WHERE constraint_name = :name"
        ),
        {"name": constraint_name},
    ).scalar()


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    # --- organization_access: rename granted_at -> created_at, add unique constraint ---
    if ORG_ACCESS_TABLE in tables:
        cols = _columns(inspector, ORG_ACCESS_TABLE)
        if 'created_at' not in cols:
            op.add_column(
                ORG_ACCESS_TABLE,
                sa.Column(
                    'created_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('now()'),
                    nullable=True,
                ),
            )
        if 'granted_at' in cols:
            op.drop_column(ORG_ACCESS_TABLE, 'granted_at')

        if ORG_ACCESS_UNIQUE not in _unique_names(inspector, ORG_ACCESS_TABLE):
            op.create_unique_constraint(
                ORG_ACCESS_UNIQUE,
                ORG_ACCESS_TABLE,
                ['user_id', 'organization_id'],
            )

    # --- password_reset_tokens: nullable created_at + CASCADE FK on user_id ---
    if PRT_TABLE in tables:
        prt_cols = {c['name']: c for c in inspector.get_columns(PRT_TABLE)}
        if 'created_at' in prt_cols and not prt_cols['created_at'].get('nullable', True):
            op.alter_column(
                PRT_TABLE,
                'created_at',
                existing_type=sa.DateTime(timezone=True),
                nullable=True,
                existing_server_default=sa.text('now()'),
            )

        if _fk_delete_rule(conn, PRT_FK) != 'CASCADE':
            # Drop only if present, then recreate with ondelete=CASCADE.
            if _fk_delete_rule(conn, PRT_FK) is not None:
                op.drop_constraint(PRT_FK, PRT_TABLE, type_='foreignkey')
            op.create_foreign_key(
                PRT_FK,
                PRT_TABLE,
                'users',
                ['user_id'],
                ['id'],
                ondelete='CASCADE',
            )

    # --- teams: add presentation_token with unique index ---
    if TEAMS_TABLE in tables:
        if 'presentation_token' not in _columns(inspector, TEAMS_TABLE):
            op.add_column(
                TEAMS_TABLE,
                sa.Column('presentation_token', sa.String(length=64), nullable=True),
            )
        if TEAMS_TOKEN_INDEX not in _index_names(inspector, TEAMS_TABLE):
            op.create_index(
                TEAMS_TOKEN_INDEX,
                TEAMS_TABLE,
                ['presentation_token'],
                unique=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if TEAMS_TABLE in tables:
        if TEAMS_TOKEN_INDEX in _index_names(inspector, TEAMS_TABLE):
            op.drop_index(TEAMS_TOKEN_INDEX, table_name=TEAMS_TABLE)
        if 'presentation_token' in _columns(inspector, TEAMS_TABLE):
            op.drop_column(TEAMS_TABLE, 'presentation_token')

    if PRT_TABLE in tables:
        if _fk_delete_rule(conn, PRT_FK) == 'CASCADE':
            op.drop_constraint(PRT_FK, PRT_TABLE, type_='foreignkey')
            op.create_foreign_key(PRT_FK, PRT_TABLE, 'users', ['user_id'], ['id'])

        prt_cols = {c['name']: c for c in inspector.get_columns(PRT_TABLE)}
        if 'created_at' in prt_cols and prt_cols['created_at'].get('nullable', True):
            op.alter_column(
                PRT_TABLE,
                'created_at',
                existing_type=sa.DateTime(timezone=True),
                nullable=False,
                existing_server_default=sa.text('now()'),
            )

    if ORG_ACCESS_TABLE in tables:
        if ORG_ACCESS_UNIQUE in _unique_names(inspector, ORG_ACCESS_TABLE):
            op.drop_constraint(ORG_ACCESS_UNIQUE, ORG_ACCESS_TABLE, type_='unique')

        cols = _columns(inspector, ORG_ACCESS_TABLE)
        if 'granted_at' not in cols:
            op.add_column(
                ORG_ACCESS_TABLE,
                sa.Column(
                    'granted_at',
                    sa.DateTime(timezone=True),
                    server_default=sa.text('now()'),
                    nullable=True,
                ),
            )
        if 'created_at' in cols:
            op.drop_column(ORG_ACCESS_TABLE, 'created_at')
