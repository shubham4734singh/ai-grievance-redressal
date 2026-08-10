from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import grievances, auth, health, upload, chat, notifications
import asyncio
import httpx
import os
from contextlib import asynccontextmanager

async def keep_alive():
    # Render automatically provides RENDER_EXTERNAL_URL for web services
    url = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:8000")
    health_url = f"{url}/api/health"
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(600)  # 10 minutes
            try:
                await client.get(health_url)
                print(f"Keep-alive ping successful: {health_url}")
            except Exception as e:
                print(f"Keep-alive ping failed: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the keep-alive task in the background
    task = asyncio.create_task(keep_alive())
    yield
    # Cancel the task when the server shuts down
    task.cancel()

app = FastAPI(
    title="AI-Grievance-Redressal",
    description="AI-Driven Citizen Grievance Redressal System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(grievances.router, prefix="/api/grievances", tags=["grievances"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

@app.get("/")
async def root():
    return {"message": "AI-Grievance-Redressal API", "status": "running"}

from pydantic import BaseModel
class NlpRequest(BaseModel):
    text: str

@app.post("/api/internal/categorize")
async def internal_categorize(req: NlpRequest):
    # Only import NLP when needed to avoid loading it in other scripts
    from app.services.nlp import categorize_grievance
    return await categorize_grievance(req.text)

