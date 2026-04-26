import asyncio
import httpx
from database import SessionLocal
from models import Team, User
from routers.auth import create_access_token
from datetime import timedelta

async def test_patch():
    db = SessionLocal()
    team = db.query(Team).first()
    admin = db.query(User).filter(User.role == "admin").first()

    if not team or not admin:
        print("Missing data")
        return

    token = create_access_token({"sub": str(admin.id)}, expires_delta=timedelta(minutes=30))
    headers = {"Authorization": f"Bearer {token}", "X-Organization-Id": str(admin.organization_id)}

    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Assuming app is running on localhost:8000
        try:
            # 1. Update manager to some ID
            res = await client.patch(f"/api/teams/{team.id}", json={"manager_id": admin.id}, headers=headers)
            print(f"Set manager response [{res.status_code}]: {res.json()}")

            # 2. Update manager to null
            res = await client.patch(f"/api/teams/{team.id}", json={"manager_id": None}, headers=headers)
            print(f"Unset manager response [{res.status_code}]: {res.json()}")
        except Exception as e:
            print("Failed to connect:", e)

asyncio.run(test_patch())
