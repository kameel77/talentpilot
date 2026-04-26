import asyncio
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Team, User
from schemas import TeamUpdate

def test_update():
    db = SessionLocal()
    # get first team
    team = db.query(Team).first()
    if not team:
        print("No team found")
        return
    print(f"Team ID: {team.id}, Manager ID: {team.manager_id}")
    
    # Let's try to update manager_id to a user
    user = db.query(User).first()
    if not user:
        print("No user found")
        return
        
    print(f"User ID: {user.id}")
    
    # Simulate the router logic
    update_data = {"manager_id": user.id}
    for key, value in update_data.items():
        setattr(team, key, value)
        
    db.commit()
    db.refresh(team)
    print(f"After update - Manager ID: {team.manager_id}")
    
    # Try setting to None
    update_data = {"manager_id": None}
    for key, value in update_data.items():
        setattr(team, key, value)
        
    db.commit()
    db.refresh(team)
    print(f"After setting None - Manager ID: {team.manager_id}")
    
test_update()
