from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None

@app.patch("/team")
def update_team(data: TeamUpdate):
    update_data = data.model_dump(exclude_unset=True)
    return {"update_data": update_data}

client = TestClient(app)

def test_patch():
    # Test sending null
    response = client.patch("/team", json={"manager_id": None})
    print("Response for null:", response.json())
    
    # Test sending value
    response = client.patch("/team", json={"manager_id": 123})
    print("Response for 123:", response.json())

    # Test sending nothing
    response = client.patch("/team", json={})
    print("Response for empty:", response.json())

if __name__ == "__main__":
    test_patch()
