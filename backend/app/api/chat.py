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
            "Your job is to help citizens file a complaint by asking them for necessary details step-by-step. "
            "You need to collect: 1) A description of the problem, and 2) The exact location (city, landmark, street). "
            "If they provide all the information, tell them you will file it right now. "
            "To trigger the auto-filing, you MUST output the final compiled complaint inside a block exactly like this:\n"
            "[SUBMIT]\n<the full detailed complaint here>\n[/SUBMIT]\n"
            "Keep responses conversational but make sure to use the [SUBMIT] tags when ready."
        )
    }
    
    messages = [system_prompt] + [msg.model_dump() for msg in request.messages]
    
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
            success_msg = f"\n\n✅ **Success!** I have automatically filed this grievance on your behalf. Your Tracking ID is **{tracking_id}**. You can monitor its status on the Track Status page."
            reply = re.sub(r"\[SUBMIT\].*?\[/SUBMIT\]", success_msg, reply, flags=re.DOTALL)
            
        return {"reply": reply}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
