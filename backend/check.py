import asyncio
from app.main import app, lifespan

print("Import successful! Testing app...")

async def test_startup():
    async with lifespan(app):
        print("Database tables created and seed data initialized successfully!")

if __name__ == "__main__":
    asyncio.run(test_startup())
