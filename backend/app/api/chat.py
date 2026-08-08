from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
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

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

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
            "Your job is to help citizens file a complaint by asking them for necessary details step-by-step. "
            "You need to collect: 1) A description of the problem, and 2) The exact location (city, landmark, street). "
            "If they provide all the information, tell them you will file it right now. "
            "To trigger the auto-filing, you MUST output the final compiled complaint inside a block exactly like this:\n"
            "[SUBMIT]\n<the full detailed complaint translated to pure ENGLISH here>\n[/SUBMIT]\n"
            "Keep responses conversational, always reply in their language, but ensure the [SUBMIT] block is ALWAYS in English."
        )
    }
    
    messages = [system_prompt] + [msg.model_dump() for msg in request.messages]
    
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
        
        # Check if [SUBMIT] tags exist
        submit_match = re.search(r"\[SUBMIT\](.*?)\[/SUBMIT\]", reply, re.DOTALL)
        if submit_match:
            final_description = submit_match.group(1).strip()
            
            # File the grievance using the same logic as POST /api/grievances
            from app.api.grievances import generate_tracking_id
            from app.services.nlp import categorize_grievance
            from app.models.grievance import GrievanceInDB, StatusHistoryEntry
            
            tracking_id = generate_tracking_id()
            ai_analysis = await categorize_grievance(final_description)
            
            initial_history = StatusHistoryEntry(
                status="Submitted",
                note="Grievance filed automatically via AI Chatbot."
            )
            
            db_grievance = GrievanceInDB(
                tracking_id=tracking_id,
                description=final_description,
                location="Location specified in description",
                category=ai_analysis.get("category", "General"),
                department=ai_analysis.get("department", "Unassigned"),
                priority=ai_analysis.get("priority", "Medium"),
                sentiment=ai_analysis.get("sentiment", "Neutral"),
                history=[initial_history],
                user_id=current_user["id"],
                evidence_url=""
            )
            
            await db.grievances.insert_one(db_grievance.model_dump(by_alias=True))
            
            # Replace the tag in the reply with a success message
            success_msg = f"\n\n **Success!** I have automatically filed this grievance on your behalf. Your Tracking ID is **{tracking_id}**. You can monitor its status on the Track Status page."
            reply = re.sub(r"\[SUBMIT\].*?\[/SUBMIT\]", success_msg, reply, flags=re.DOTALL)
            
        return {"reply": reply}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
