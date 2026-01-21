import pytest
from sqlalchemy.orm import Session
from models import Talent, TalentTranslation, UserTalent, GallupDomain, User, Organization
from services.assistant_service import get_user_talents, build_prompt, DOMAIN_LABELS

def test_get_user_talents(db_session: Session, test_user: User):
    """Test that get_user_talents returns enriched metadata."""
    # Seed talents
    t1 = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    t2 = Talent(code="activator", domain=GallupDomain.INFLUENCING)
    db_session.add_all([t1, t2])
    db_session.flush()

    db_session.add_all([
        TalentTranslation(talent_id=t1.id, language="pl", name="Osiąganie"),
        TalentTranslation(talent_id=t2.id, language="pl", name="Aktywator"),
        UserTalent(user_id=test_user.id, talent_id=t1.id, rank=1),
        UserTalent(user_id=test_user.id, talent_id=t2.id, rank=2),
    ])
    db_session.commit()

    talents = get_user_talents(db_session, test_user.id, "pl")
    
    assert len(talents) == 2
    assert talents[0] == {"name": "Osiąganie", "rank": 1, "domain": "executing"}
    assert talents[1] == {"name": "Aktywator", "rank": 2, "domain": "influencing"}

def test_build_prompt_with_metadata(db_session: Session):
    """Test that build_prompt correctly formats talent metadata."""
    talents = [
        {"name": "Osiąganie", "rank": 1, "domain": "executing"},
        {"name": "Aktywator", "rank": 6, "domain": "influencing"},
    ]
    question = "Jak działać?"
    
    messages = build_prompt(db_session, question, talents, [], "pl")
    
    system_msg = messages[0]["content"]
    user_msg = messages[1]["content"]
    
    # Check that domain labels are translated
    assert DOMAIN_LABELS["executing"] in user_msg
    assert DOMAIN_LABELS["influencing"] in user_msg
    
    # Check Top 5 marker
    assert "[TOP 5] Rank 1: Osiąganie" in user_msg
    assert "Rank 6: Aktywator" in user_msg
    assert "[TOP 5] Rank 6" not in user_msg
    
    assert "Jak działać?" in user_msg
