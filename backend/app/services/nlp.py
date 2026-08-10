import json
from groq import AsyncGroq
from app.core.config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

async def categorize_grievance(description: str) -> dict:
    prompt = f"""
    Analyze the following grievance description and provide a categorization.
    Respond ONLY with a valid JSON object (no markdown, no backticks, no extra text).
    
    Fields required in JSON:
    - category: string (MUST be one of: "Water Supply", "Electricity", "Roads", "Sanitation", "Public Safety")
    - department: string (MUST be EXACTLY one of these 5 options: "Water Department", "Electricity Board", "Roads & Transport", "Sanitation & Waste", "Police & Security"). Ignore user's own suggested department if it contradicts the actual issue.
    - priority: string (Choose one: Low, Medium, High, Urgent. Urgent is for life-threatening or severe issues)
    - sentiment: string (Choose one: Positive, Neutral, Negative, Angry)
    
    CRITICAL: Carefully analyze the ROOT CAUSE of the problem (e.g., if it says 'electrical problem', it MUST go to 'Electricity Board' and 'Electricity', regardless of the user saying 'public safety'). Focus on the actual issue, ignore typos. For cases involving sexual harassment, abuse, or stalking, you MUST assign it to the "Police & Security" department and mark the priority as "Urgent".
    
    Description: {description}
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a government grievance categorization AI that outputs strictly in JSON format."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        # Fallback in case of API failure
        return {
            "category": "General",
            "department": "General Administration",
            "priority": "Medium",
            "sentiment": "Neutral"
        }

async def generate_solution_plan(description: str, department: str, priority: str) -> str:
    prompt = f"""
    You are an expert civic administration AI assistant.
    A citizen has reported a grievance. Your job is to provide a brief, actionable 3-step resolution plan for the government officer handling this ticket.
    
    Grievance Description: "{description}"
    Assigned Department: {department}
    Priority: {priority}
    
    Provide the response as a short, professional bulleted list (max 3 bullets). Be highly specific and actionable based on the description. Do NOT use markdown bold/italics, just standard text.
    """
    
    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant for government officers."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return "1. Review the grievance details.\n2. Contact the citizen if more info is needed.\n3. Dispatch the appropriate field team."

async def generate_officer_summary(
    description: str,
    location: str,
    department: str,
    priority: str,
    sentiment: str,
    duplicate_of: str | None = None,
    has_evidence: bool = False,
) -> str:
    prompt = f"""
    You are an expert civic operations analyst preparing a compact briefing for a government officer.

    Grievance Description: "{description}"
    Location: {location}
    Assigned Department: {department}
    Priority: {priority}
    Citizen Sentiment: {sentiment}
    Duplicate Of: {duplicate_of or "None"}
    Evidence Image Attached: {"Yes" if has_evidence else "No"}

    Write a practical officer-facing summary with exactly these labels:
    Issue:
    Urgency:
    Duplicate Risk:
    Evidence:
    First Action:

    Keep the whole summary under 120 words. Be specific, operational, and avoid markdown tables.
    """

    try:
        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You write concise operational summaries for civic grievance officers."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        duplicate_text = f"Related to {duplicate_of}." if duplicate_of else "No duplicate currently linked."
        evidence_text = "Evidence image is attached." if has_evidence else "No evidence image attached."
        return (
            f"Issue: {description}\n"
            f"Urgency: {priority} priority for {department} based on {sentiment.lower()} citizen sentiment.\n"
            f"Duplicate Risk: {duplicate_text}\n"
            f"Evidence: {evidence_text}\n"
            f"First Action: Verify the location, contact the citizen if needed, and assign the field team."
        )
