import requests
import json
import sys

# Get an access token
response = requests.post("http://localhost:8000/api/auth/login", data={"username": "test@test.com", "password": "password"})
if response.status_code != 200:
    print(f"Login failed: {response.text}")
    sys.exit(1)
token = response.json().get("access_token")

# Get the matrix
response = requests.get(
    "http://localhost:8000/api/teams/1/matrix",
    headers={"Authorization": f"Bearer {token}"}
)
if response.status_code != 200:
    print(f"Failed to get matrix: {response.text}")
    sys.exit(1)
    
print(json.dumps(response.json(), indent=2))
