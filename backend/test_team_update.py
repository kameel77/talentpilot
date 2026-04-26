import asyncio
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Team, User
from schemas import TeamUpdate
from routers.teams import update_team

def test():
    db = SessionLocal()
    # Get any team
    team = db.query(Team).first()
    if not team:
        print("No team found")
        return
    # Get a user in the same org
    user = db.query(User).filter(User.organization_id == team.organization_id).first()
    if not user:
        print("No user found")
        return
    
    print(f"Updating team {team.id} manager_id to {user.id}")
    try:
        updated = update_team(team.id, TeamUpdate(manager_id=user.id), db, current_user=user, active_org_id=team.organization_id)
        print("Success:", updated.manager_id)
        
        print("Now setting to None")
        updated2 = update_team(team.id, TeamUpdate(manager_id=None), db, current_user=user, active_org_id=team.organization_id)
        print("Success None:", updated2.manager_id)
    except Exception as e:
        print("Error:", e)

test()
