import requests

def main():
    login_res = requests.post("http://localhost:8000/api/auth/token", data={
        "username": "kameel77seo@gmail.com",
        "password": "password"  # Replace with actual if needed, or we just write a route to bypass
    })
    print("Login:", login_res.status_code)
