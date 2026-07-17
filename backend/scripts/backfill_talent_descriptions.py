"""Backfill Polish short descriptions for talents in an existing database.

Idempotent: only fills empty short_description fields on PL translations.
Never overwrites values already set (e.g. edited by an admin in the CMS).

Usage: python scripts/backfill_talent_descriptions.py
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Talent, TalentTranslation
from scripts.seed_talents import PL_TALENT_SHORT_DESCRIPTIONS


def backfill(db: Session) -> None:
    updated = 0
    skipped = 0
    for talent in db.query(Talent).all():
        short_desc = PL_TALENT_SHORT_DESCRIPTIONS.get(talent.code)
        if not short_desc:
            continue
        translation = (
            db.query(TalentTranslation)
            .filter(
                TalentTranslation.talent_id == talent.id,
                TalentTranslation.language == "pl",
            )
            .first()
        )
        if translation is None:
            print(f"⚠️  {talent.code}: no PL translation row, skipping")
            skipped += 1
            continue
        if translation.short_description:
            skipped += 1
            continue
        translation.short_description = short_desc
        updated += 1
    db.commit()
    print(f"✅ Updated {updated} PL short descriptions, skipped {skipped}.")


def main() -> None:
    db = SessionLocal()
    try:
        backfill(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
