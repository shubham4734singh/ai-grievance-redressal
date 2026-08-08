from fastapi import APIRouter, Depends, HTTPException
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from app.core.database import get_database
from app.api.deps import get_current_user
from app.models.notification import NotificationResponse

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    cursor = db.notifications.find({"user_id": current_user["id"]}).sort("created_at", -1).limit(20)
    notifications = await cursor.to_list(length=20)
    
    for notif in notifications:
        notif["id"] = str(notif.pop("_id"))
        
    return notifications

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
        
    result = await db.notifications.update_one(
        {"_id": obj_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    return {"message": "Notification marked as read"}
