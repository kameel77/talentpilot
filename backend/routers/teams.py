"""Teams router for CRUD operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Team, UserRole
from schemas import TeamCreate, TeamUpdate, TeamResponse
from auth import get_current_user, require_role

router = APIRouter()


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    """
    Create new team (admin or manager).
    
    - Team belongs to current user's organization
    """
    team = Team(
        name=data.name,
        description=data.description,
        organization_id=current_user.organization_id,
        manager_id=data.manager_id
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    
    return team


@router.get("", response_model=List[TeamResponse])
def list_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all teams in current user's organization.
    
    - Managers see all teams
    - Regular users see only their teams
    """
    query = db.query(Team).filter(Team.organization_id == current_user.organization_id)
    
    # If user is not admin/manager, filter to their teams only
    if current_user.role == UserRole.USER:
        query = query.join(Team.members).filter(User.id == current_user.id)
    
    teams = query.all()
    return teams


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    if team.organization_id != current_user.organization_id:
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
    current_user: User = Depends(require_role(["admin", "manager"]))
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
    if team.organization_id != current_user.organization_id:
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
    current_user: User = Depends(require_role(["admin"]))
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
    if team.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this team"
        )
    
    db.delete(team)
    db.commit()
    
    return None
