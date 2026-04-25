"""Teams router for CRUD operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Team, UserRole, OrganizationAccess, Organization
from schemas import TeamCreate, TeamUpdate, TeamResponse
from auth import get_current_user, require_role, get_current_active_org_id
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
    if team.organization_id != active_org_id:
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
    current_user: User = Depends(require_role(["admin", "manager"])),
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
    if team.organization_id != active_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    # Update fields
    if data.name is not None:
        team.name = data.name
    if data.description is not None:
        team.description = data.description
    if data.manager_id is not None:
        team.manager_id = data.manager_id
    
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
    if team.organization_id != active_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    db.delete(team)
    db.commit()
    
    return None


@router.post("/{team_id}/generate-matrix", response_model=GenerateMatrixResponse)
async def generate_matrix(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"])),
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
    if team.organization_id != active_org_id:
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
            "role": member.role.value,
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
