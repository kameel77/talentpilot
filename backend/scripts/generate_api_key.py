
"""Script to generate a new API key for external integrations."""
import secrets
import argparse
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ApiKey

def generate_key(name: str):
    db: Session = SessionLocal()
    try:
        key = secrets.token_urlsafe(32)
        new_api_key = ApiKey(
            key=key,
            name=name,
            is_active=True
        )
        db.add(new_api_key)
        db.commit()
        print(f"✅ API Key generated successfully!")
        print(f"Name: {name}")
        print(f"Key:  {key}")
        print(f"Header: X-API-Key: {key}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a new API key")
    parser.add_argument("--name", type=str, required=True, help="Name of the external app/integration")
    args = parser.parse_args()
    generate_key(args.name)
