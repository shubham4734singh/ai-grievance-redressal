from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional

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
