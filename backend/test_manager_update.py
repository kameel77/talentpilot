import requests
import json

base_url = "http://localhost:8000"

def test():
    # 1. Login to get token
    login_data = {
        "username": "kamil@motolia.pl", # or whichever user exists
        "password": "password123" # need to guess or just create a user
    }
    # Actually, we can use the db to create a test token or bypass auth.
    pass
