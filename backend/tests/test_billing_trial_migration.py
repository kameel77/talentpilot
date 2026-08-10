"""Tests for alembic/versions/y4z5a6b7c8d9_grant_existing_orgs_90_day_trial.py

Phase 2b task brief §C / §TESTS. Runs the migration's `upgrade()`/
`downgrade()` functions directly against a scratch SQLite database via
`alembic.operations.Operations.context(...)` — the standard way to unit
test a single Alembic migration in isolation, without replaying the full
migration history (a from-scratch SQLite replay of this repo's full chain
hits an unrelated, pre-existing `sa.text("now()")` issue in an early
migration — see that migration's own module docstring and
`s8t9u0v1w2x3_add_billing_domain.py`'s docstring for the precedent; this
repo's actual test suite never replays migrations at all, it builds tables
via `Base.metadata.create_all()`, same as this file does).
"""
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models import Organization, PlanTier, SubscriptionStatus

_MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent
    / "alembic"
    / "versions"
    / "y4z5a6b7c8d9_grant_existing_orgs_90_day_trial.py"
)


def _load_migration_module():
    spec = importlib.util.spec_from_file_location("grant_trial_migration", _MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration_module()


@pytest.fixture
def scratch_db(tmp_path):
    """A throwaway SQLite DB with the current ORM schema (post-`s8t9u0v1w2x3`,
    the migration's declared `down_revision`) — equivalent to a production
    DB that has already run every migration up to and including that one."""
    db_path = tmp_path / "scratch_trial_migration.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    yield engine, Session
    engine.dispose()


def _run_upgrade(engine):
    with engine.connect() as connection:
        ctx = MigrationContext.configure(connection)
        with Operations.context(ctx):
            migration.upgrade()
        connection.commit()


def _run_downgrade(engine):
    with engine.connect() as connection:
        ctx = MigrationContext.configure(connection)
        with Operations.context(ctx):
            migration.downgrade()
        connection.commit()


def test_org_with_null_trial_and_free_status_gets_90_day_trial(scratch_db):
    engine, Session = scratch_db
    db = Session()
    org = Organization(
        name="Existing Coach Workspace",
        is_workspace=True,
        plan=PlanTier.FREE,
        subscription_status=SubscriptionStatus.FREE,
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_upgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.plan == PlanTier.FREE  # plan untouched, per task brief §C
    assert org_after.trial_ends_at is not None
    expected = datetime.now(timezone.utc) + timedelta(days=90)
    trial_ends_at = org_after.trial_ends_at
    if trial_ends_at.tzinfo is None:
        trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)
    assert abs((trial_ends_at - expected).total_seconds()) < 60
    db.close()


def test_client_org_is_workspace_false_is_untouched(scratch_db):
    engine, Session = scratch_db
    db = Session()
    org = Organization(
        name="Client Org",
        is_workspace=False,
        plan=PlanTier.FREE,
        subscription_status=SubscriptionStatus.FREE,
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_upgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    assert org_after.subscription_status == SubscriptionStatus.FREE
    assert org_after.trial_ends_at is None
    db.close()


def test_org_that_already_has_trial_ends_at_is_untouched(scratch_db):
    """An org with `trial_ends_at` already set (e.g. a design partner
    granted a trial via the admin panel before this migration ran) must not
    be touched — the migration's WHERE clause requires `trial_ends_at IS
    NULL`."""
    engine, Session = scratch_db
    existing_trial = datetime.now(timezone.utc) + timedelta(days=45)
    db = Session()
    org = Organization(
        name="Design Partner",
        is_workspace=True,
        plan=PlanTier.FREE,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at=existing_trial,
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_upgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    trial_ends_at = org_after.trial_ends_at
    if trial_ends_at.tzinfo is None:
        trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)
    assert abs((trial_ends_at - existing_trial).total_seconds()) < 1
    db.close()


def test_running_migration_twice_does_not_extend_trial(scratch_db):
    engine, Session = scratch_db
    db = Session()
    org = Organization(
        name="Existing Coach Workspace",
        is_workspace=True,
        plan=PlanTier.FREE,
        subscription_status=SubscriptionStatus.FREE,
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_upgrade(engine)

    db = Session()
    trial_ends_at_first = db.query(Organization).filter(Organization.id == org_id).first().trial_ends_at
    db.close()

    # Replay: simulates the migration file executing again (e.g. a second
    # deploy of the same image re-running `alembic upgrade head` against a
    # DB that never recorded the revision, or a manual re-invocation).
    _run_upgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    assert org_after.trial_ends_at == trial_ends_at_first
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    db.close()


def test_downgrade_reverts_migration_granted_trial(scratch_db):
    engine, Session = scratch_db
    db = Session()
    org = Organization(
        name="Existing Coach Workspace",
        is_workspace=True,
        plan=PlanTier.FREE,
        subscription_status=SubscriptionStatus.FREE,
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_upgrade(engine)
    _run_downgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    assert org_after.subscription_status == SubscriptionStatus.FREE
    assert org_after.trial_ends_at is None
    db.close()


def test_downgrade_does_not_revert_org_with_billing_customer_id(scratch_db):
    """An org that completed a real Stripe checkout after this migration
    ran (`billing_customer_id` set by the CHECKOUT_COMPLETED webhook
    transition) must survive a downgrade of this migration — it's on a
    genuine trial/subscription, not the migration-granted one."""
    engine, Session = scratch_db
    db = Session()
    org = Organization(
        name="Real Customer",
        is_workspace=True,
        plan=PlanTier.PRO,
        subscription_status=SubscriptionStatus.TRIALING,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
        billing_customer_id="cus_real_customer",
    )
    db.add(org)
    db.commit()
    org_id = org.id
    db.close()

    _run_downgrade(engine)

    db = Session()
    org_after = db.query(Organization).filter(Organization.id == org_id).first()
    assert org_after.subscription_status == SubscriptionStatus.TRIALING
    assert org_after.trial_ends_at is not None
    db.close()
