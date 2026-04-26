from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import Team, User
import sys

client = TestClient(app)

db = SessionLocal()
team = db.query(Team).first()
admin = db.query(User).filter(User.role == "admin").first()

if not team or not admin:
    print("Missing data")
    sys.exit(1)

# we need a token for admin
from routers.auth import create_access_token
from datetime import timedelta
token = create_access_token({"sub": str(admin.id)}, expires_delta=timedelta(minutes=30))
headers = {"Authorization": f"Bearer {token}", "X-Organization-Id": str(admin.organization_id)}

print(f"Original manager: {team.manager_id}")

# 1. Update manager to some ID
res = client.patch(f"/api/teams/{team.id}", json={"manager_id": admin.id}, headers=headers)
print(f"Set manager response: {res.json()}")

# 2. Update manager to null
res = client.patch(f"/api/teams/{team.id}", json={"manager_id": None}, headers=headers)
print(f"Unset manager response: {res.json()}")
