import asyncio
from httpx import AsyncClient
from main import app

async def test():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # First login as admin
        response = await client.post("/api/auth/token", data={
            "username": "kameel77seo@gmail.com",
            "password": "password" # just guessing, or we can mock auth
        })
        print(response.status_code, response.text)

asyncio.run(test())
