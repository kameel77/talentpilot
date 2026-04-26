from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User
from auth import get_current_user

# override dependency
def override_get_current_user():
    db = SessionLocal()
    return db.query(User).filter(User.email == "kameel77seo@gmail.com").first()

app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

response = client.patch("/api/teams/1", json={"manager_id": None})
print("PATCH manager_id=None:", response.status_code, response.json())

response = client.patch("/api/teams/1", json={"manager_id": 1})
print("PATCH manager_id=1:", response.status_code, response.json())
