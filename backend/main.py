from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import grievances, auth, health, upload, chat, notifications

app = FastAPI(
    title="AI-Grievance-Redressal",
    description="AI-Driven Citizen Grievance Redressal System",
    version="1.0.0"
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
