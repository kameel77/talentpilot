import asyncio
from httpx import AsyncClient
from database import SessionLocal
from models import User
from auth import create_access_token

async def test():
    db = SessionLocal()
    admin = db.query(User).filter(User.email == "admin@talentpilot.pl").first()
    if not admin:
        admin = db.query(User).first()
    token = create_access_token({"sub": admin.email})
    
    async with AsyncClient(base_url="http://localhost:8000") as client:
        # Get team matrix
        print("Getting matrix...")
        r = await client.get("/api/teams/1/matrix", headers={"Authorization": f"Bearer {token}", "X-Organization-Id": "1"})
        print(r.status_code)
        
        print("Setting manager to null...")
        r = await client.patch("/api/teams/1", json={"manager_id": None}, headers={"Authorization": f"Bearer {token}", "X-Organization-Id": "1"})
        print(r.status_code, r.json())

        print("Setting manager to 1...")
        r = await client.patch("/api/teams/1", json={"manager_id": 1}, headers={"Authorization": f"Bearer {token}", "X-Organization-Id": "1"})
        print(r.status_code, r.json())

asyncio.run(test())
