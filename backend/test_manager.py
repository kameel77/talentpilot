import asyncio
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Team, User
import sys

def test():
    db = SessionLocal()
    team = db.query(Team).first()
    if not team:
        print("No teams")
        return
    
    print(f"Team: {team.id} manager_id={team.manager_id}")
    if team.members:
        member = team.members[0]
        print(f"First member: {member.id} {member.full_name}")
        team.manager_id = member.id
        db.commit()
        db.refresh(team)
        print(f"Updated manager_id to {team.manager_id}")
        
        print("Is leader:", team.manager_id == member.id)
    else:
        print("No members")

test()
