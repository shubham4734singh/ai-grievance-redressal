from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import asyncio

client = AsyncIOMotorClient(settings.MONGODB_URL)
database = client[settings.DATABASE_NAME]

def get_database():
    return database

COLLECTIONS = {
    "grievances": "grievances",
    "users": "users",
    "status_history": "status_history",
    "departments": "departments",
    "notifications": "notifications"
}

async def init_collections():
    db = get_database()
    
    for name, collection_name in COLLECTIONS.items():
        if collection_name not in await db.list_collection_names():
            if name == "status_history":
                await db.create_collection(
                    collection_name,
                    timeseries={
                        "timeField": "timestamp",
                        "metaField": "metadata",
                        "granularity": "seconds"
                    }
                )
            else:
                await db.create_collection(collection_name)
            print(f"Created collection: {collection_name}")
        else:
            print(f"Collection already exists: {collection_name}")

def run_init():
    asyncio.run(init_collections())
