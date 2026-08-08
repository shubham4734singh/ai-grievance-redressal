from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class NotificationCreate(BaseModel):
    user_id: str
    tracking_id: str
    title: str
    message: str

class NotificationInDB(NotificationCreate):
    id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationResponse(NotificationInDB):
    pass
