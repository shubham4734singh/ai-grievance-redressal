import json
from groq import AsyncGroq
from app.core.config import settings

client = AsyncGroq(api_key=settings.GROQ_API_KEY)

async def categorize_grievance(description: str) -> dict:
    prompt = f"""
    Analyze the following grievance description and provide a categorization.
    Respond ONLY with a valid JSON object (no markdown, no backticks, no extra text).
    
    Fields required in JSON:
    - category: string (e.g., Water Supply, Electricity, Roads, Sanitation, Public Safety, etc.)
    - department: string (The government department responsible, e.g., Municipal Corporation, Electricity Board, PWD)
    - priority: string (Choose one: Low, Medium, High, Urgent. Urgent is for life-threatening or severe issues)
    - sentiment: string (Choose one: Positive, Neutral, Negative, Angry)
    
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
