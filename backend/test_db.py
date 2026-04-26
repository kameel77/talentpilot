from database import SessionLocal
from models import Team, User
db = SessionLocal()
team = db.query(Team).first()
if team:
    print(f"Team: {team.id}, {team.name}, org: {team.organization_id}, manager: {team.manager_id}")
    users = db.query(User).filter(User.organization_id == team.organization_id).all()
    for u in users:
        print(f"User: {u.id}, {u.full_name}, role: {u.role}")
