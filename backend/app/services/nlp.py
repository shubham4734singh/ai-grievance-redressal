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
    
    CRITICAL: Carefully analyze the ROOT CAUSE of the problem (e.g., if it says 'electrical problem', it MUST go to 'Electricity Board' and 'Electricity', regardless of the user saying 'public safety'). Focus on the actual issue, ignore typos.
    
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
