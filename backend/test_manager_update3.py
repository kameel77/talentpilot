import asyncio
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Team, User
from schemas import TeamUpdate
from routers.teams import update_team

def test():
    db = SessionLocal()
    admin = db.query(User).filter(User.role == "ADMIN").first()
    team = db.query(Team).first()
    
    print(f"Old manager: {team.manager_id}")
    
    # Try updating to None explicitly via JSON load to simulate FastAPI
    update_data = TeamUpdate.model_validate({"manager_id": None})
    update_team(team.id, update_data, db, admin, active_org_id=team.organization_id)
    
    db.commit()
    db.refresh(team)
    print(f"New manager: {team.manager_id}")

test()
