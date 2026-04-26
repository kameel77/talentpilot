import requests

def test_matrix():
    # Login
    login_data = {"username": "admin@example.com", "password": "adminpassword"}
    r = requests.post("http://localhost:8000/api/auth/token", data=login_data)
    token = r.json().get("access_token")
    
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get("http://localhost:8000/api/teams", headers=headers)
    print(r.json())

if __name__ == "__main__":
    test_matrix()
