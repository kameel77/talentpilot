"""Teams router for CRUD operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Team, UserRole, OrganizationAccess, Organization, UserTalent
from services.email_service import send_team_added_email
from schemas import (
    TeamCreate,
    TeamUpdate,
    TeamResponse,
    PublicTeamPresentationResponse,
    PresentationOrg,
    PresentationMember,
    PresentationTalentResult
)
from auth import get_current_user, require_role, get_current_active_org_id
from routers.invitations import compute_invitation_status
from config import settings
import httpx
from pydantic import BaseModel


def _accessible_org_ids(db: Session, user: User) -> set[int]:
    """Return the set of organization IDs the user can access for team operations."""
    if user.role == UserRole.ADMIN:
        return {org_id for (org_id,) in db.query(Organization.id).all()}
    org_ids = {user.organization_id}
    if user.role == UserRole.COACH:
        access_rows = db.query(OrganizationAccess.organization_id).filter(
            OrganizationAccess.user_id == user.id
        ).all()
        org_ids.update(org_id for (org_id,) in access_rows)
    return org_ids


def _serialize_team(team: Team) -> dict:
    return {
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "organization_id": team.organization_id,
        "organization_name": team.organization.name if team.organization else None,
        "manager_id": team.manager_id,
        "members_count": len(team.members),
        "created_at": team.created_at,
    }

class GenerateMatrixResponse(BaseModel):
    url: str
    message: str

class ReplaceMemberRequest(BaseModel):
    ghost_user_id: int
    existing_user_id: int

router = APIRouter()


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """Create a new team within an organization the user can access."""
    target_org_id = data.organization_id or active_org_id

    accessible = _accessible_org_ids(db, current_user)
    if target_org_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this organization"
        )

    if not db.query(Organization).filter(Organization.id == target_org_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    team = Team(
        name=data.name,
        description=data.description,
        organization_id=target_org_id,
        manager_id=data.manager_id,
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    return _serialize_team(team)


@router.get("", response_model=List[TeamResponse])
def list_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    List teams visible to the current user.

    - Admin: all teams across all organizations
    - Coach: teams across home organization + organizations they have access to
    - Manager: teams in the active organization
    - User: only the teams they belong to within the active organization
    """
    if current_user.role in (UserRole.ADMIN, UserRole.COACH):
        org_ids = _accessible_org_ids(db, current_user)
        teams = db.query(Team).filter(Team.organization_id.in_(org_ids)).all()
    elif current_user.role == UserRole.MANAGER:
        teams = db.query(Team).filter(Team.organization_id == active_org_id).all()
    else:
        teams = (
            db.query(Team)
            .join(Team.members)
            .filter(Team.organization_id == active_org_id, User.id == current_user.id)
            .all()
        )

    return [_serialize_team(t) for t in teams]


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Get team details.
    
    - Users can only access teams in their organization
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    return team


@router.patch("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Update team (admin or manager).
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data:
        team.name = update_data["name"]
    if "description" in update_data:
        team.description = update_data["description"]
    if "manager_id" in update_data:
        team.manager_id = update_data["manager_id"]
    
    db.commit()
    db.refresh(team)
    
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Delete team (admin only).
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    db.delete(team)
    db.commit()
    
    return None


@router.get("/{team_id}/matrix", response_model=PublicTeamPresentationResponse)
def get_team_matrix(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Get matrix data for a team.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )

    org = team.organization
    
    presentation_members = []
    for member in team.members:
        results = []
        for ut in member.user_talents:
            talent = ut.talent
            if talent:
                results.append(PresentationTalentResult(
                    id=str(ut.id),
                    rank=ut.rank,
                    talent=talent.code,
                    domain=talent.domain.value
                ))
                
        presentation_members.append(PresentationMember(
            id=str(member.id),
            name=member.full_name,
            email=member.email,
            role=member.role.value if hasattr(member.role, "value") else member.role,
            is_leader=(team.manager_id == member.id),
            is_ghost=member.is_ghost,
            invited_at=member.invited_at,
            invitation_status=compute_invitation_status(member),
            results=results
        ))

    return PublicTeamPresentationResponse(
        id=str(team.id),
        name=team.name,
        organization=PresentationOrg(id=str(org.id), name=org.name),
        members=presentation_members
    )


@router.post("/{team_id}/generate-matrix", response_model=GenerateMatrixResponse)
async def generate_matrix(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Generate a presentation matrix for a team in TalentPilot Team application.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
        
    if not settings.talentpilot_team_url or not settings.external_api_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="TalentPilot Team integration is not configured."
        )

    # Gather Payload Data
    org = team.organization
    
    users_payload = []
    for member in team.members:
        talents_payload = []
        for ut in member.user_talents:
            talent = ut.talent
            if talent:
                talents_payload.append({
                    "rank": ut.rank,
                    "talent_code": talent.code,
                    "domain": talent.domain.value
                })
        
        users_payload.append({
            "full_name": member.full_name,
            "email": member.email,
            "role": member.role.value if hasattr(member.role, "value") else member.role,
            "talents": talents_payload
        })

    payload = {
        "organization_id": org.id,
        "organization_name": org.name,
        "team_id": team.id,
        "team_name": team.name,
        "users": users_payload
    }

    # Make Request
    try:
        async with httpx.AsyncClient() as client:
            base_url = settings.talentpilot_team_url.rstrip('/')
            url = f"{base_url}/api/external/import-matrix"
            
            response = await client.post(
                url,
                json=payload,
                headers={"X-API-Key": settings.external_api_key},
                timeout=15.0
            )
            response.raise_for_status()
            data = response.json()
            
            # The URL returned should be absolute. If relative, prepend host,
            # but usually it's relative in team, so we should build a full URL to open.
            path = data.get("url", "")
            if not path.startswith("http"):
                path = f"{base_url}{path if path.startswith('/') else '/' + path}"
                
            return GenerateMatrixResponse(
                url=path,
                message="Matrix generated successfully"
            )
    except httpx.HTTPStatusError as e:
        error_detail = "Failed to communicate with TalentPilot Team API"
        try:
            err_data = e.response.json()
            error_detail = err_data.get("error", error_detail)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=error_detail
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Integration error: {str(e)}"
        )

@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
):
    """Remove a user from a team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if user in team.members:
        team.members.remove(user)
        db.commit()



@router.post("/{team_id}/replace-member", status_code=status.HTTP_200_OK)
def replace_member(
    team_id: int,
    data: ReplaceMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Replace a ghost user with an existing user in a team.
    
    Transfers talents from the ghost to the existing user (if existing has none),
    adds the existing user to the team, removes/archives the ghost, and sends
    an email notification to the existing user.
    """
    # 1. Validate team access
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    accessible = _accessible_org_ids(db, current_user)
    if team.organization_id not in accessible:
        raise HTTPException(status_code=403, detail="Access denied to this team")

    # 2. Validate users
    ghost_user = db.query(User).filter(User.id == data.ghost_user_id).first()
    existing_user = db.query(User).filter(User.id == data.existing_user_id).first()
    
    if not ghost_user or not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if ghost_user not in team.members:
        raise HTTPException(status_code=400, detail="Ghost user is not a member of this team")

    # 3. Transfer talents from ghost → existing (overwrite)
    ghost_talents = db.query(UserTalent).filter(UserTalent.user_id == ghost_user.id).all()
    if ghost_talents:
        # Remove existing user's current talents
        db.query(UserTalent).filter(UserTalent.user_id == existing_user.id).delete()
        # Re-assign ghost's talents to existing user
        for ut in ghost_talents:
            ut.user_id = existing_user.id
        db.flush()

    # 4. Transfer manual fields if existing user doesn't have them
    for field in ['superpowers', 'motivators', 'blockers', 'feedback_style',
                  'superpowers_en', 'motivators_en', 'blockers_en', 'feedback_style_en',
                  'job_title', 'job_title_en']:
        ghost_val = getattr(ghost_user, field, None)
        existing_val = getattr(existing_user, field, None)
        if ghost_val and not existing_val:
            setattr(existing_user, field, ghost_val)

    # 5. Add existing user to team (if not already)
    if existing_user not in team.members:
        team.members.append(existing_user)

    # 6. If ghost was team manager, transfer to existing
    if team.manager_id == ghost_user.id:
        team.manager_id = existing_user.id

    # 7. Remove ghost from team and archive
    if ghost_user in team.members:
        team.members.remove(ghost_user)
    
    if ghost_user.is_ghost:
        # Permanently delete ghost users
        db.delete(ghost_user)
    else:
        # Archive real users
        ghost_user.is_active = False

    db.commit()

    # 8. Send email notification (non-blocking)
    try:
        org_name = team.organization.name if team.organization else "TalentPilot"
        send_team_added_email(
            to_email=existing_user.email,
            full_name=existing_user.full_name,
            team_name=team.name,
            org_name=org_name,
        )
    except Exception:
        pass  # Don't block API response on email failure

    return {
        "message": "Member replaced successfully",
        "user": {
            "id": existing_user.id,
            "full_name": existing_user.full_name,
            "email": existing_user.email,
        },
        "talents_transferred": len(ghost_talents) if ghost_talents else 0,
    }
