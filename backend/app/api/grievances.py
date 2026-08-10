from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import secrets
import string
from app.core.database import get_database
from app.api.deps import get_current_user
from app.models.grievance import GrievanceCreate, GrievanceResponse, GrievanceInDB, StatusHistoryEntry
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.nlp import categorize_grievance
from app.services.similarity import find_location_duplicate
from app.services.notifications import create_notification, notify_department_admins, send_telegram_message

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

    # Check for duplicates in the same category and nearby GPS area when available.
    duplicate_tracking_id = None
    duplicate_match = None
    if grievance_dict.get("category"):
        recent_similar = await db.grievances.find(
            {"category": grievance_dict["category"], "status": {"$ne": "Resolved"}},
            {"tracking_id": 1, "description": 1, "latitude": 1, "longitude": 1}
        ).to_list(length=50)

        duplicate_match = find_location_duplicate(
            grievance.description,
            grievance.latitude,
            grievance.longitude,
            recent_similar,
        )
        duplicate_tracking_id = duplicate_match["tracking_id"] if duplicate_match else None

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

    duplicate_note = ""
    if duplicate_match and duplicate_match.get("reason") == "location_text":
        duplicate_note = f" It appears related to {duplicate_tracking_id}, about {duplicate_match['distance_meters']}m away."
    elif duplicate_tracking_id:
        duplicate_note = f" It appears related to {duplicate_tracking_id}."

    await create_notification(
        db,
        current_user["id"],
        tracking_id,
        "Grievance Submitted",
        f"Your grievance has been submitted and routed to {ai_analysis.get('department', 'Unassigned')}.{duplicate_note}",
    )

    # --- SEND TO DEPARTMENT ON TELEGRAM ---
    dept_name = ai_analysis.get("department", "Unassigned")
    dept_admin = await db.users.find_one({"role": "admin", "department": dept_name, "telegram_chat_id": {"$exists": True, "$ne": ""}})

    if dept_admin and dept_admin.get("telegram_chat_id"):
        target_group_id = dept_admin["telegram_chat_id"]

        c_name = grievance.contact_name or current_user.get("full_name", "Citizen")
        c_phone = grievance.contact_phone or current_user.get("phone", "N/A")
        c_email = grievance.contact_email or current_user.get("email", "N/A")

        if grievance.contact_name and current_user.get("full_name") and grievance.contact_name != current_user.get("full_name"):
            c_name = f"{grievance.contact_name} (Account: {current_user.get('full_name')})"
        if grievance.contact_phone and current_user.get("phone") and grievance.contact_phone != current_user.get("phone"):
            c_phone = f"{grievance.contact_phone} (Account: {current_user.get('phone')})"
        if grievance.contact_email and current_user.get("email") and grievance.contact_email != current_user.get("email"):
            c_email = f"{grievance.contact_email} (Account: {current_user.get('email')})"

        officer_msg = (
            f"*New Grievance Assigned to {dept_name}*\n\n"
            f"*Tracking ID:* `{tracking_id}`\n"
            f"*Category:* {grievance_dict.get('category', 'General')}\n"
            f"*Priority:* {ai_analysis.get('priority', 'Medium')}\n"
            f"*Location:* {grievance.location}\n\n"
            f"*Description:* {grievance.description}\n\n"
            f"*Reporter Name:* {c_name}\n"
            f"*Reporter Phone:* {c_phone}\n"
            f"*Reporter Email:* {c_email}"
        )

        await send_telegram_message(target_group_id, officer_msg)
    # --------------------------------------

    await notify_department_admins(
        db,
        dept_name,
        tracking_id,
        "New Grievance Assigned",
        f"{tracking_id} has been routed to {dept_name} with {ai_analysis.get('priority', 'Medium')} priority.{duplicate_note}",
        send_telegram=False,
    )

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

class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=1000)

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

    await create_notification(
        db,
        grievance.get("user_id"),
        tracking_id,
        f"Status Update: {update_data.status}",
        update_data.note,
    )

    # Send Telegram Notification if they submitted via bot
    telegram_chat_id = grievance.get("telegram_chat_id")
    if telegram_chat_id:
        msg = f"*Update on your Grievance {tracking_id}*\n\nThe status has been updated to: *{update_data.status}*\n\n*Officer's Note:* {update_data.note}"
        await send_telegram_message(telegram_chat_id, msg)

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

@router.get("/duplicates/clusters")
async def get_duplicate_clusters(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view duplicate clusters")

    dept = current_user.get("department", "All")
    match_query = {"duplicate_of": {"$exists": True, "$nin": [None, ""]}}
    if dept != "All":
        match_query["department"] = dept

    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$duplicate_of",
                "duplicate_count": {"$sum": 1},
                "latest_reported_at": {"$max": "$created_at"},
                "tracking_ids": {"$push": "$tracking_id"},
                "category": {"$first": "$category"},
                "department": {"$first": "$department"},
                "priority": {"$max": "$priority"},
            }
        },
        {"$sort": {"duplicate_count": -1, "latest_reported_at": -1}},
        {"$limit": 25},
    ]

    clusters = await db.grievances.aggregate(pipeline).to_list(length=25)
    for cluster in clusters:
        root = await db.grievances.find_one(
            {"tracking_id": cluster["_id"]},
            {"tracking_id": 1, "description": 1, "location": 1, "latitude": 1, "longitude": 1, "status": 1}
        )
        cluster["root_tracking_id"] = cluster.pop("_id")
        cluster["total_reports"] = cluster["duplicate_count"] + 1
        if root:
            cluster["root"] = {
                "tracking_id": root.get("tracking_id"),
                "description": root.get("description"),
                "location": root.get("location"),
                "latitude": root.get("latitude"),
                "longitude": root.get("longitude"),
                "status": root.get("status"),
            }

    return {"clusters": clusters}

@router.post("/track/{tracking_id}/feedback", response_model=GrievanceResponse)
async def submit_grievance_feedback(
    tracking_id: str,
    feedback: FeedbackRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if grievance.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the submitting citizen can rate this grievance")
    if grievance.get("status") != "Resolved":
        raise HTTPException(status_code=400, detail="Feedback can only be submitted after resolution")

    submitted_at = datetime.utcnow()
    await db.grievances.update_one(
        {"tracking_id": tracking_id},
        {
            "$set": {
                "feedback_rating": feedback.rating,
                "feedback_comment": feedback.comment or "",
                "feedback_submitted_at": submitted_at,
            }
        }
    )

    await notify_department_admins(
        db,
        grievance.get("department", "Unassigned"),
        tracking_id,
        "Citizen Feedback Received",
        f"{tracking_id} received a {feedback.rating}/5 satisfaction rating.",
        send_telegram=False,
    )

    updated_grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    updated_grievance["id"] = str(updated_grievance.pop("_id"))
    return GrievanceResponse(**updated_grievance)

from app.services.nlp import generate_solution_plan, generate_officer_summary

@router.get("/track/{tracking_id}/solution")
async def get_grievance_solution(
    tracking_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can request AI solutions")

    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")

    plan = await generate_solution_plan(
        description=grievance.get("description", ""),
        department=grievance.get("department", "Unassigned"),
        priority=grievance.get("priority", "Medium")
    )

    return {"solution_plan": plan}

@router.get("/track/{tracking_id}/summary")
async def get_officer_summary(
    tracking_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can request AI summaries")

    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        raise HTTPException(status_code=404, detail="Grievance not found")

    dept = current_user.get("department", "All")
    if dept != "All" and grievance.get("department") != dept:
        raise HTTPException(status_code=403, detail="Not authorized to summarize this department")

    summary = await generate_officer_summary(
        description=grievance.get("description", ""),
        location=grievance.get("location", "Not provided"),
        department=grievance.get("department", "Unassigned"),
        priority=grievance.get("priority", "Medium"),
        sentiment=grievance.get("sentiment", "Neutral"),
        duplicate_of=grievance.get("duplicate_of"),
        has_evidence=bool(grievance.get("evidence_url")),
    )

    return {"summary": summary}
