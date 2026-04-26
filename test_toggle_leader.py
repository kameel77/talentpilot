import asyncio
from httpx import AsyncClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User

async def main():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "test@test.com").first()
    if not admin:
        admin = db.query(User).first()
    
    # We need to simulate the API call to toggle leader
    # Actually, we can just use requests against localhost:8000
