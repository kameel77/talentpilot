from database import SessionLocal
from models import Team

db = SessionLocal()
team = db.query(Team).first()
if team:
    print(f"Team ID: {team.id}, Manager ID: {team.manager_id}")
    team.manager_id = 1
    db.commit()
    print("Updated to 1.")
