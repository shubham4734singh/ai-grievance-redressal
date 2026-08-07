from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

class GrievanceCreate(BaseModel):
    description: str
    location: Optional[str] = None
    category: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class GrievanceResponse(BaseModel):
    id: str
    description: str
    location: Optional[str]
    category: Optional[str]
    status: str
    priority: str
    created_at: datetime

@router.post("/", response_model=GrievanceResponse)
async def create_grievance(grievance: GrievanceCreate):
    return GrievanceResponse(
        id="GRV-2026-00001",
        description=grievance.description,
        location=grievance.location,
        category=grievance.category or "Pending",
        status="submitted",
        priority="medium",
        created_at=datetime.now()
    )

@router.get("/{grievance_id}")
async def get_grievance(grievance_id: str):
    return {"id": grievance_id, "status": "submitted"}
