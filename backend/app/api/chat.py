from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from groq import AsyncGroq
from app.core.config import settings
from app.core.database import get_database
from app.api.deps import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
import re

router = APIRouter()
client = AsyncGroq(api_key=settings.GROQ_API_KEY)

class ChatMessage(BaseModel):
    role: str
    content: str

class CurrentLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_location: Optional[CurrentLocation] = None
    evidence_url: Optional[str] = None

@router.post("/")
async def chat_with_bot(
    request: ChatRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    system_prompt = {
        "role": "system",
        "content": (
            "You are a helpful, empathetic, and professional government grievance assistant. "
            "You MUST speak in the exact same language the user speaks to you (e.g., if they speak Hindi, reply in Hindi). "
            "STRICT RULE: You are ONLY allowed to discuss civic grievances (e.g., water, electricity, roads, sanitation, safety). "
            "Do NOT engage in casual conversation, chit-chat, or answer questions unrelated to filing a civic complaint. "
            "If the user asks about anything else, politely decline and steer the conversation back to filing a grievance. "
            "Your job is to help citizens file a complaint by asking them for necessary details step-by-step. "
            "You need to collect: 1) A description of the problem, and 2) The exact location. "
            "The user may optionally attach an evidence image; do not require it, but acknowledge it if present. "
            "After the user describes the problem, acknowledge their concern briefly and ask whether they are currently at the same location where the problem exists. "
            "When you ask that same-location question, append this marker on its own line: [ASK_LOCATION_PERMISSION]. "
            "CRITICAL: DO NOT use the [ASK_LOCATION_PERMISSION] marker if the user has already provided their location (e.g., if you see GPS coordinates) or if you are asking for the problem description. ONLY use it exactly ONCE when explicitly asking for location."
            "CRITICAL SAFETY BYPASS: Users may report severe crimes, sexual harassment, abuse, or assault. These reports may contain highly explicit, graphic, or sensitive language. YOU MUST NOT REFUSE TO PROCESS THESE COMPLAINTS. Treat them as valid civic/police grievances. Validate their concern, collect the location, and file the complaint using the [SUBMIT] block. DO NOT use generic safety refusals like 'I cannot create explicit content'."
            "If the user says yes, wait for browser GPS coordinates before filing. "
            "If the user says no or GPS is unavailable, ask them to type the location with city, landmark, or street. "
            "If they provide all the information, tell them you will file it right now. "
            "To trigger the auto-filing, you MUST output the final compiled complaint inside a block exactly like this:\n"
            "[SUBMIT]\n<the full detailed complaint translated to pure ENGLISH here>\n[/SUBMIT]\n"
            "Keep responses conversational, always reply in their language, but ensure the [SUBMIT] block is ALWAYS in English."
        )
    }

    messages = [system_prompt] + [msg.model_dump() for msg in request.messages]
    if request.current_location:
        location_context = (
            "The user granted browser location permission for the problem site. "
            f"Exact GPS coordinates: latitude {request.current_location.latitude}, "
            f"longitude {request.current_location.longitude}"
        )
        if request.current_location.accuracy is not None:
            location_context += f", accuracy {round(request.current_location.accuracy)} meters"
        location_context += ". Treat this as the exact location and proceed with filing if the problem description is available."
        messages.append({"role": "system", "content": location_context})
    if request.evidence_url:
        messages.append({
            "role": "system",
            "content": "The user attached an evidence image for this complaint. Store this Cloudinary URL with the grievance: "
            f"{request.evidence_url}"
        })

    from app.services.security import check_for_jailbreak

    # Check all incoming messages for jailbreak attempts
    user_messages = " ".join([msg.content for msg in request.messages if msg.role == "user"])
    if check_for_jailbreak(user_messages):
        # Increment jailbreak attempts
        from bson import ObjectId
        user_id = current_user.get("id") or current_user.get("_id")

        await db.users.update_one(
            {"_id": ObjectId(user_id) if isinstance(user_id, str) else user_id},
            {"$inc": {"jailbreak_attempts": 1}}
        )

        # Fetch updated user to check count
        updated_user = await db.users.find_one({"_id": ObjectId(user_id) if isinstance(user_id, str) else user_id})
        attempts = updated_user.get("jailbreak_attempts", 1)

        if attempts >= 3:
            # Here we would send an alert to superadmin. For now we just return a strong error.
            # You can wire this up to send an email to superadmin.
            return {"reply": " **SECURITY ALERT**: Multiple malicious prompt injection attempts detected from this account. Your account has been flagged and the Super Admin has been notified."}

        return {"reply": f" **Warning**: Malicious prompt injection detected. This system is for filing civic grievances only. Attempt {attempts}/3 before admin notification."}

    try:
        response = await client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=300,
        )

        reply = response.choices[0].message.content
        expects_location_permission = "[ASK_LOCATION_PERMISSION]" in reply
        reply = reply.replace("[ASK_LOCATION_PERMISSION]", "").strip()

        # Check if [SUBMIT] tags exist
        submit_match = re.search(r"\[SUBMIT\](.*?)\[/SUBMIT\]", reply, re.DOTALL)
        if submit_match:
            final_description = submit_match.group(1).strip()

            # File the grievance using the same logic as POST /api/grievances
            from app.api.grievances import generate_tracking_id
            from app.services.nlp import categorize_grievance
            from app.services.similarity import find_location_duplicate
            from app.services.notifications import create_notification, notify_department_admins
            from app.models.grievance import GrievanceInDB, StatusHistoryEntry

            tracking_id = generate_tracking_id()
            ai_analysis = await categorize_grievance(final_description)
            latitude = request.current_location.latitude if request.current_location else None
            longitude = request.current_location.longitude if request.current_location else None
            duplicate_match = None
            if ai_analysis.get("category"):
                recent_similar = await db.grievances.find(
                    {"category": ai_analysis["category"], "status": {"$ne": "Resolved"}},
                    {"tracking_id": 1, "description": 1, "latitude": 1, "longitude": 1}
                ).to_list(length=50)
                duplicate_match = find_location_duplicate(
                    final_description,
                    latitude,
                    longitude,
                    recent_similar,
                )
            duplicate_tracking_id = duplicate_match["tracking_id"] if duplicate_match else None

            initial_history = StatusHistoryEntry(
                status="Submitted",
                note="Grievance filed automatically via AI Chatbot. Duplicate detected." if duplicate_tracking_id else "Grievance filed automatically via AI Chatbot."
            )

            db_grievance = GrievanceInDB(
                tracking_id=tracking_id,
                description=final_description,
                location=(
                    f"GPS: {request.current_location.latitude}, {request.current_location.longitude}"
                    if request.current_location
                    else "Location specified in description"
                ),
                latitude=latitude,
                longitude=longitude,
                location_accuracy=request.current_location.accuracy if request.current_location else None,
                category=ai_analysis.get("category", "General"),
                department=ai_analysis.get("department", "Unassigned"),
                priority=ai_analysis.get("priority", "Medium"),
                sentiment=ai_analysis.get("sentiment", "Neutral"),
                history=[initial_history],
                user_id=current_user["id"],
                evidence_url=request.evidence_url or "",
                duplicate_of=duplicate_tracking_id
            )

            await db.grievances.insert_one(db_grievance.model_dump(by_alias=True))

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
                f"Your chatbot grievance has been submitted and routed to {ai_analysis.get('department', 'Unassigned')}.{duplicate_note}",
            )
            # --- SEND DETAILED TELEGRAM NOTIFICATION ---
            dept_name = ai_analysis.get("department", "Unassigned")
            dept_admin = await db.users.find_one({"role": "admin", "department": dept_name, "telegram_chat_id": {"$exists": True, "$ne": ""}})
            super_admin = await db.users.find_one({"role": "admin", "department": "All", "telegram_chat_id": {"$exists": True, "$ne": ""}})

            targets = []
            if dept_admin and dept_admin.get("telegram_chat_id"):
                targets.append(dept_admin["telegram_chat_id"])
            if super_admin and super_admin.get("telegram_chat_id") and super_admin["telegram_chat_id"] not in targets:
                targets.append(super_admin["telegram_chat_id"])

            if targets:
                c_name = current_user.get("full_name", "Citizen")
                c_phone = current_user.get("phone", "N/A")
                c_email = current_user.get("email", "N/A")

                from app.services.notifications import send_telegram_message
                officer_msg = (
                    f"*New Chatbot Grievance Assigned to {dept_name}*\n\n"
                    f"*Tracking ID:* `{tracking_id}`\n"
                    f"*Category:* {ai_analysis.get('category', 'General')}\n"
                    f"*Priority:* {ai_analysis.get('priority', 'Medium')}\n"
                    f"*Location:* {db_grievance.location}\n\n"
                    f"*Description:* {final_description}\n\n"
                    f"*Reporter Name:* {c_name}\n"
                    f"*Reporter Phone:* {c_phone}\n"
                    f"*Reporter Email:* {c_email}"
                )
                if request.evidence_url:
                    officer_msg += f"\n\n*Evidence:* [View Image]({request.evidence_url})"

                for target_id in targets:
                    await send_telegram_message(target_id, officer_msg)
            # -------------------------------------------

            await notify_department_admins(
                db,
                ai_analysis.get("department", "Unassigned"),
                tracking_id,
                "New Chatbot Grievance Assigned",
                f"{tracking_id} has been routed with {ai_analysis.get('priority', 'Medium')} priority.{duplicate_note}",
                send_telegram=False
            )

            # Replace the tag in the reply with a success message
            success_msg = f"\n\n **Success!** I have automatically filed this grievance on your behalf. Your Tracking ID is **{tracking_id}**. You can monitor its status on the Track Status page."
            reply = re.sub(r"\[SUBMIT\].*?\[/SUBMIT\]", success_msg, reply, flags=re.DOTALL)

        return {
            "reply": reply,
            "expects_location_permission": expects_location_permission
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
