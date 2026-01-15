import sys
import os

# Add the backend directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import User, Organization, UserRole
from auth import hash_password

def seed_user():
    db = SessionLocal()
    try:
        # Check if organization exists
        org_name = "IzzyLease"
        org = db.query(Organization).filter(Organization.name == org_name).first()
        if not org:
            org = Organization(name=org_name)
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"Created organization: {org_name}")
        
        # User details
        email = "kamil.tonkowicz@izzylease.pl"
        full_name = "Kamil Tonkowicz"
        password = "sukces123"
        
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User {email} already exists. Updating password.")
            user.hashed_password = hash_password(password)
            user.full_name = full_name
            user.organization_id = org.id
            user.role = UserRole.ADMIN
        else:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                organization_id=org.id,
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(user)
            print(f"Created user: {email}")
        
        db.commit()
        print("Seed completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_user()
