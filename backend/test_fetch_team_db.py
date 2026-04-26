from database import SessionLocal
from models import Team

db = SessionLocal()
team = db.query(Team).first()
if team:
    for member in team.members:
        print(f"Member: {member.full_name}, is_leader: {team.manager_id == member.id}")
        for ut in member.user_talents:
            print(f"  Talent: {ut.talent.code if ut.talent else 'None'}, Rank: {ut.rank}")
