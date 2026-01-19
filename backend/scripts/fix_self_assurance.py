"""Fix self-assurance talent code in database.

Run this script after ensuring the database is accessible.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal
from models import Talent

def fix_self_assurance():
    db = SessionLocal()
    try:
        # Find talent with old code
        talent = db.query(Talent).filter(Talent.code == 'self_assurance').first()
        
        if talent:
            print(f"Found talent with code: '{talent.code}'")
            talent.code = 'self-assurance'
            db.commit()
            print("✅ Successfully updated 'self_assurance' to 'self-assurance'")
        else:
            # Check if already updated
            talent_new = db.query(Talent).filter(Talent.code == 'self-assurance').first()
            if talent_new:
                print("✅ Talent code is already 'self-assurance' - no update needed")
            else:
                print("❌ ERROR: No talent found with code 'self_assurance' or 'self-assurance'")
                print("   You may need to run the seed script to add all talents")
    except Exception as e:
        print(f"❌ ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_self_assurance()
