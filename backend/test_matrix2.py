from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User

db = SessionLocal()
user = db.query(User).filter(User.role == "ADMIN").first()
if not user:
    user = db.query(User).first()

client = TestClient(app)

from auth import create_access_token
from datetime import timedelta
token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(days=1))
headers = {"Authorization": f"Bearer {token}", "X-Organization-Id": str(user.organization_id)}

resp = client.get("/api/teams/1/matrix", headers=headers)
if resp.status_code == 200:
    data = resp.json()
    members = data.get("members", [])
    if members:
        print("First member results:")
        print(members[0].get("results", []))
    else:
        print("No members")
else:
    print(resp.status_code, resp.json())
