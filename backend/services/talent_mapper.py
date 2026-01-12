"""Business logic service for mapping user talents to Gallup domains."""
from typing import Dict
from sqlalchemy.orm import Session

from models import User, UserTalent, Talent, GallupDomain


def map_user_talents_to_domains(user_id: int, db: Session) -> Dict[str, int]:
    """
    Aggregate user's Top 5 talents and calculate dominance in 4 Gallup domains.
    
    Args:
        user_id: ID of the user
        db: Database session
    
    Returns:
        Dictionary with domain counts:
        {
            "executing": 2,
            "influencing": 1,
            "relationship_building": 1,
            "strategic_thinking": 1
        }
    """
    # Get user talents with talent info
    user_talents = db.query(UserTalent).join(Talent).filter(
        UserTalent.user_id == user_id
    ).all()
    
    # Initialize distribution
    distribution = {
        "executing": 0,
        "influencing": 0,
        "relationship_building": 0,
        "strategic_thinking": 0
    }
    
    # Count by domain
    for ut in user_talents:
        domain = ut.talent.domain
        if domain == GallupDomain.EXECUTING:
            distribution["executing"] += 1
        elif domain == GallupDomain.INFLUENCING:
            distribution["influencing"] += 1
        elif domain == GallupDomain.RELATIONSHIP_BUILDING:
            distribution["relationship_building"] += 1
        elif domain == GallupDomain.STRATEGIC_THINKING:
            distribution["strategic_thinking"] += 1
    
    return distribution


def get_dominant_domain(user_id: int, db: Session) -> str:
    """
    Get user's dominant Gallup domain based on talent count.
    
    Args:
        user_id: ID of the user
        db: Database session
    
    Returns:
        Name of dominant domain (e.g., "executing")
        If tie, returns first alphabetically
    """
    distribution = map_user_talents_to_domains(user_id, db)
    
    # Find max count
    max_count = max(distribution.values())
    
    # Get domains with max count (handle ties)
    dominant_domains = [
        domain for domain, count in distribution.items()
        if count == max_count
    ]
    
    # Return first alphabetically if tie
    return sorted(dominant_domains)[0]
