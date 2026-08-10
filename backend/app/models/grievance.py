from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class GrievanceCreate(BaseModel):
    description: str
    location: str
    evidence_url: str
    category: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None
    telegram_chat_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None

class StatusHistoryEntry(BaseModel):
    status: str
    note: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class GrievanceInDB(GrievanceCreate):
    tracking_id: str
    status: str = "Submitted"
    priority: str = "Unassigned"
    department: str = "Unassigned"
    sentiment: str = "Neutral"
    duplicate_of: Optional[str] = None
    feedback_rating: Optional[int] = None
    feedback_comment: Optional[str] = None
    feedback_submitted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    history: List[StatusHistoryEntry] = []
    user_id: Optional[str] = None

class GrievanceResponse(GrievanceInDB):
    id: str
    citizen_details: Optional[dict] = None
