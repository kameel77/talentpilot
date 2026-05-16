"""Dashboard aggregate endpoints.

Replaces the previous N+1 fetch pattern on the dashboard landing page
(1 call for the user list + N parallel calls for each user's talents)
with a single SQL aggregate.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GallupDomain, Talent, User, UserRole, UserTalent, user_teams
from schemas import DashboardMember, DashboardOverview, TeamDomainCounts
from auth import get_current_user, get_current_active_org_id

router = APIRouter()


@router.get("/overview", response_model=DashboardOverview)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id),
):
    """Aggregate data for the dashboard landing page in one call.

    Visibility rules match `GET /api/users/`:
    - USER role sees only teammates
    - ADMIN/MANAGER/COACH see everyone in the active organization
    """
    visible_users_q = db.query(User.id).filter(User.organization_id == active_org_id)

    if current_user.role == UserRole.USER:
        my_team_ids = db.query(user_teams.c.team_id).filter(
            user_teams.c.user_id == current_user.id
        )
        teammate_ids = db.query(user_teams.c.user_id).filter(
            user_teams.c.team_id.in_(my_team_ids)
        )
        visible_users_q = visible_users_q.filter(User.id.in_(teammate_ids))

    visible_user_ids = [row.id for row in visible_users_q.all()]
    total_users = len(visible_user_ids)

    team_domains = TeamDomainCounts()
    users_with_talents = 0
    members: list[DashboardMember] = []

    if visible_user_ids:
        domain_rows = (
            db.query(Talent.domain, func.count(UserTalent.id))
            .join(UserTalent, UserTalent.talent_id == Talent.id)
            .filter(UserTalent.user_id.in_(visible_user_ids))
            .group_by(Talent.domain)
            .all()
        )
        domain_counts = {domain: count for domain, count in domain_rows}
        team_domains = TeamDomainCounts(
            executing=domain_counts.get(GallupDomain.EXECUTING, 0),
            influencing=domain_counts.get(GallupDomain.INFLUENCING, 0),
            relationship_building=domain_counts.get(GallupDomain.RELATIONSHIP_BUILDING, 0),
            strategic_thinking=domain_counts.get(GallupDomain.STRATEGIC_THINKING, 0),
        )

        users_with_talents = (
            db.query(func.count(func.distinct(UserTalent.user_id)))
            .filter(UserTalent.user_id.in_(visible_user_ids))
            .scalar()
            or 0
        )

        member_rows = (
            db.query(User)
            .filter(User.id.in_(visible_user_ids))
            .order_by(User.full_name)
            .limit(6)
            .all()
        )
        members = [
            DashboardMember(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=u.role.value,
            )
            for u in member_rows
        ]

    return DashboardOverview(
        total_users=total_users,
        users_with_talents=users_with_talents,
        team_domains=team_domains,
        members=members,
    )
