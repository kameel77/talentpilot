from database import SessionLocal
from models import User
from routers.teams import update_team
from schemas import TeamUpdate

db = SessionLocal()
admin = db.query(User).filter(User.role == "admin").first()
print(update_team(team_id=1, data=TeamUpdate(manager_id=None), db=db, current_user=admin, active_org_id=1))
