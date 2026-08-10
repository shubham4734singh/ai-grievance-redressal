from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional
from math import atan2, cos, radians, sin, sqrt

EARTH_RADIUS_METERS = 6371000

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate approximate distance between two GPS coordinates using the Haversine formula.
    """
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)

    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return EARTH_RADIUS_METERS * c

def find_duplicate(new_description: str, existing_grievances: List[Dict], threshold: float = 0.5) -> Optional[str]:
    """
    Returns the tracking_id of a duplicate grievance if cosine similarity > threshold.
    existing_grievances must contain 'tracking_id' and 'description' keys.
    """
    if not existing_grievances:
        return None
        
    descriptions = [g["description"] for g in existing_grievances]
    descriptions.append(new_description)
    
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform(descriptions)
    except ValueError:
        # Happens if vocab is empty (e.g. all stop words)
        return None
        
    # The new description is the last row in the matrix
    cosine_sim = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])
    
    # Find the max similarity
    max_idx = cosine_sim.argmax()
    max_score = cosine_sim[0][max_idx]
    
    if max_score >= threshold:
        return existing_grievances[max_idx]["tracking_id"]
        
    return None

def find_location_duplicate(
    new_description: str,
    latitude: Optional[float],
    longitude: Optional[float],
    existing_grievances: List[Dict],
    text_threshold: float = 0.35,
    radius_meters: float = 300,
) -> Optional[Dict]:
    """
    Find a likely duplicate by combining text similarity with distance.
    Returns metadata so callers can explain why the case was clustered.
    """
    if latitude is None or longitude is None or not existing_grievances:
        duplicate_id = find_duplicate(new_description, existing_grievances, threshold=0.5)
        return {"tracking_id": duplicate_id, "reason": "text", "score": None, "distance_meters": None} if duplicate_id else None

    candidates = [
        grievance
        for grievance in existing_grievances
        if grievance.get("latitude") is not None and grievance.get("longitude") is not None
    ]
    if not candidates:
        duplicate_id = find_duplicate(new_description, existing_grievances, threshold=0.5)
        return {"tracking_id": duplicate_id, "reason": "text", "score": None, "distance_meters": None} if duplicate_id else None

    descriptions = [g["description"] for g in candidates] + [new_description]
    try:
        tfidf_matrix = TfidfVectorizer(stop_words="english").fit_transform(descriptions)
    except ValueError:
        return None

    similarities = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])[0]
    best_match = None

    for index, grievance in enumerate(candidates):
        distance = calculate_distance_meters(
            latitude,
            longitude,
            grievance["latitude"],
            grievance["longitude"],
        )
        if distance > radius_meters:
            continue

        text_score = float(similarities[index])
        proximity_score = max(0, 1 - (distance / radius_meters))
        combined_score = (text_score * 0.7) + (proximity_score * 0.3)

        if text_score >= text_threshold and (best_match is None or combined_score > best_match["score"]):
            best_match = {
                "tracking_id": grievance["tracking_id"],
                "reason": "location_text",
                "score": round(combined_score, 3),
                "text_score": round(text_score, 3),
                "distance_meters": round(distance),
            }

    return best_match
