from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import secrets
import string
from app.core.database import get_database
from app.api.deps import get_current_user
from app.models.grievance import GrievanceCreate, GrievanceResponse, GrievanceInDB, StatusHistoryEntry
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.nlp import categorize_grievance
from app.services.similarity import find_duplicate

router = APIRouter()

def generate_tracking_id():
    chars = string.ascii_uppercase + string.digits
    return "GRV-" + "".join(secrets.choice(chars) for _ in range(8))

@router.post("/", response_model=GrievanceResponse)
async def create_grievance(
    grievance: GrievanceCreate, 
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    tracking_id = generate_tracking_id()
    
    # Run AI Categorization
    ai_analysis = await categorize_grievance(grievance.description)
    
    grievance_dict = grievance.model_dump()
    if ai_analysis.get("category"):
        grievance_dict["category"] = ai_analysis["category"]
        
    # Check for duplicates in the same category
    duplicate_tracking_id = None
    if grievance_dict.get("category"):
        recent_similar = await db.grievances.find(
            {"category": grievance_dict["category"], "status": {"$ne": "Resolved"}},
            {"tracking_id": 1, "description": 1}
        ).to_list(length=50)
        
        duplicate_tracking_id = find_duplicate(grievance.description, recent_similar)
    
    initial_history = StatusHistoryEntry(
        status="Submitted",
        note="Grievance has been successfully submitted. Duplicate detected." if duplicate_tracking_id else "Grievance has been successfully submitted."
    )
    
    db_grievance = GrievanceInDB(
        **grievance_dict,
        tracking_id=tracking_id,
        history=[initial_history],
        user_id=current_user["id"],
        department=ai_analysis.get("department", "Unassigned"),
        priority=ai_analysis.get("priority", "Medium"),
        sentiment=ai_analysis.get("sentiment", "Neutral"),
        duplicate_of=duplicate_tracking_id
    )
    
    doc = db_grievance.model_dump(by_alias=True)
    result = await db.grievances.insert_one(doc)
    
    created_grievance = await db.grievances.find_one({"_id": result.inserted_id})
    created_grievance["id"] = str(created_grievance.pop("_id"))
    
    return GrievanceResponse(**created_grievance)

@router.get("/track/{tracking_id}", response_model=GrievanceResponse)
async def track_grievance(
    tracking_id: str, 
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
        
    # Optional: Only allow tracking if it belongs to the user or if user is admin
    if grievance.get("user_id") != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to track this grievance")
        
    grievance["id"] = str(grievance.pop("_id"))
    return GrievanceResponse(**grievance)

from typing import List

from bson import ObjectId

@router.get("/", response_model=List[GrievanceResponse])
async def list_grievances(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") == "admin":
        dept = current_user.get("department", "All")
        query = {} if dept == "All" else {"department": dept}
    else:
        query = {"user_id": current_user["id"]}
        
    cursor = db.grievances.find(query).sort("created_at", -1)
    
    grievances = []
    async for grievance in cursor:
        grievance["id"] = str(grievance.pop("_id"))
        
        # Attach user details if available
        if grievance.get("user_id"):
            user = await db.users.find_one({"_id": ObjectId(grievance["user_id"])})
            if user:
                grievance["citizen_details"] = {
                    "full_name": user.get("full_name"),
                    "email": user.get("email"),
                    "phone": user.get("phone")
                }
                
        grievances.append(GrievanceResponse(**grievance))
        
    return grievances

class StatusUpdateRequest(BaseModel):
    status: str
    note: str
    priority: Optional[str] = None

@router.put("/track/{tracking_id}/status", response_model=GrievanceResponse)
async def update_grievance_status(
    tracking_id: str,
    update_data: StatusUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update status")
        
    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
        
    new_history = StatusHistoryEntry(
        status=update_data.status,
        note=update_data.note
    )
    
    update_fields = {
        "status": update_data.status
    }
    if update_data.priority:
        update_fields["priority"] = update_data.priority
        
    await db.grievances.update_one(
        {"tracking_id": tracking_id},
        {
            "$set": update_fields,
            "$push": {"history": new_history.model_dump()}
        }
    )
    
    # Create notification for the user
    from app.models.notification import NotificationInDB
    if grievance.get("user_id"):
        notif = NotificationInDB(
            user_id=grievance["user_id"],
            tracking_id=tracking_id,
            title=f"Status Update: {update_data.status}",
            message=update_data.note
        )
        await db.notifications.insert_one(notif.model_dump(by_alias=True))
    
    updated_grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    updated_grievance["id"] = str(updated_grievance.pop("_id"))
    return GrievanceResponse(**updated_grievance)

@router.get("/analytics/dashboard")
async def get_analytics(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view analytics")
        
    dept = current_user.get("department", "All")
    pipeline = []
    
    if dept != "All":
        pipeline.append({"$match": {"department": dept}})
        
    pipeline.append(
        {"$facet": {
            "total": [{"$count": "count"}],
            "by_status": [
                {"$group": {"_id": "$status", "count": {"$sum": 1}}}
            ],
            "by_category": [
                {"$group": {"_id": "$category", "count": {"$sum": 1}}}
            ],
            "by_priority": [
                {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
            ]
        }}
    )
    
    result = await db.grievances.aggregate(pipeline).to_list(1)
    data = result[0]
    
    return {
        "total": data["total"][0]["count"] if data["total"] else 0,
        "status_distribution": {item["_id"]: item["count"] for item in data["by_status"]},
        "category_distribution": {item["_id"] or "Uncategorized": item["count"] for item in data["by_category"]},
        "priority_distribution": {item["_id"]: item["count"] for item in data["by_priority"]}
    }
