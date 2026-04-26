from database import SessionLocal
from models import User, Team

db = SessionLocal()
user = db.query(User).filter(User.role == "ADMIN").first()
if not user:
    user = db.query(User).first()
print(f"User: {user.email}, Role: {user.role}, Org: {user.organization_id}")

teams = db.query(Team).all()
for t in teams:
    print(f"Team: {t.id}, Org: {t.organization_id}, Manager: {t.manager_id}")
