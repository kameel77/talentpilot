"""Script to update existing talent translations in the database without re-seeding everything.

Usage:
    python backend/scripts/update_talent_translations.py
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Talent, TalentTranslation

UPDATED_PL_NAMES = {
    "ideation": "Odkrywczość",
    "positivity": "Optymista",
    "belief": "Pryncypialność",
    "includer": "Integrator",
    "significance": "Poważanie",
    "relator": "Bliskość",
    "connectedness": "Współzależność",
}

def update_translations(db: Session):
    print("🔄 Updating Polish talent translations in database...")
    
    updated_count = 0
    for code, new_name in UPDATED_PL_NAMES.items():
        # Find the talent by code
        talent = db.query(Talent).filter(Talent.code == code).first()
        if not talent:
            print(f"⚠️ Talent with code '{code}' not found.")
            continue
            
        # Find the PL translation for this talent
        translation = db.query(TalentTranslation).filter(
            TalentTranslation.talent_id == talent.id,
            TalentTranslation.language == "pl"
        ).first()
        
        if translation:
            if translation.name != new_name:
                print(f"  - Updating '{code}': '{translation.name}' -> '{new_name}'")
                translation.name = new_name
                updated_count += 1
            else:
                print(f"  - Translation for '{code}' is already '{new_name}'.")
        else:
            print(f"⚠️ PL translation for '{code}' not found.")
            
    if updated_count > 0:
        db.commit()
        print(f"✅ Successfully updated {updated_count} translations!")
    else:
        print("✅ No translations needed updating.")

def main():
    print("=" * 50)
    print("TalentPilot - Update Talent Translations")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        update_translations(db)
    except Exception as e:
        print(f"❌ Error updating translations: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("=" * 50)

if __name__ == "__main__":
    main()
