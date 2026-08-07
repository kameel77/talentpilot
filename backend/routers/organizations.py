"""Organizations router for CRUD operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, Organization, UserRole, OrganizationAccess
from schemas import OrganizationCreate, OrganizationUpdate, OrganizationUpgradeRequest, OrganizationResponse
from auth import get_current_user, require_role, check_org_access
from services.plan_limits import assert_within_limit

router = APIRouter()


@router.get("", response_model=List[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List organizations visible to the current user.
    - Admin: all organizations
    - Coach: home organization + accessed organizations
    - Manager/User: only their home organization
    """
    if current_user.role == UserRole.ADMIN:
        organizations = db.query(Organization).all()
    elif current_user.role == UserRole.COACH:
        org_ids = {current_user.organization_id}
        if current_user.organization_id is None:
            org_ids = set()
        access_rows = db.query(OrganizationAccess.organization_id).filter(
            OrganizationAccess.user_id == current_user.id
        ).all()
        org_ids.update(org_id for (org_id,) in access_rows)
        if not org_ids:
            return []
        organizations = db.query(Organization).filter(
            Organization.id.in_(org_ids),
            Organization.is_workspace.is_(False),
        ).all()
    else:
        if current_user.organization_id is None:
            return []
        organizations = db.query(Organization).filter(Organization.id == current_user.organization_id).all()
        
    return organizations


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Create a new organization (admin or coach)."""
    # Plan limits are only meaningful for coaches — they are the billing
    # entity (see docs/BRIEF_BILLING_TRIAL.md §4). Admins bypass.
    if current_user.role == UserRole.COACH and current_user.organization is not None:
        assert_within_limit(db, current_user.organization, "client_orgs")

    organization = Organization(
        name=data.name,
        street=data.street,
        postal_code=data.postal_code,
        city=data.city,
        tax_id=data.tax_id,
    )
    db.add(organization)
    db.flush()  # get organization.id before commit

    # Auto-grant access to the creator (coach) so they can view the org
    if current_user.role == UserRole.COACH:
        access = OrganizationAccess(
            user_id=current_user.id,
            organization_id=organization.id,
        )
        db.add(access)

    db.commit()
    db.refresh(organization)

    return organization


@router.get("/{organization_id}", response_model=OrganizationResponse)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get organization details.
    
    - Admin: can access any
    - Coach: can access home org or via OrganizationAccess
    - Others: only home org
    """
    has_access = False
    
    if current_user.role == UserRole.ADMIN:
        has_access = True
    elif current_user.role == UserRole.COACH:
        if current_user.organization_id == organization_id:
            has_access = True
        else:
            access = db.query(OrganizationAccess).filter(
                OrganizationAccess.user_id == current_user.id,
                OrganizationAccess.organization_id == organization_id
            ).first()
            if access:
                has_access = True
    else:
        if current_user.organization_id == organization_id:
            has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return organization


@router.patch("/{organization_id}", response_model=OrganizationResponse)
def update_organization(
    organization_id: int,
    data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
):
    """Update organization details. Admin, manager (own org), or coach (accessible orgs)."""
    has_access = False

    if current_user.role == UserRole.ADMIN:
        has_access = True
    elif current_user.role == UserRole.COACH:
        if current_user.organization_id == organization_id:
            has_access = True
        else:
            access = db.query(OrganizationAccess).filter(
                OrganizationAccess.user_id == current_user.id,
                OrganizationAccess.organization_id == organization_id
            ).first()
            if access:
                has_access = True
    elif current_user.role == UserRole.MANAGER:
        if current_user.organization_id == organization_id:
            has_access = True

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    organization = db.query(Organization).filter(Organization.id == organization_id).first()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    payload = data.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"]:
        payload["name_confirmed"] = True
    for field, value in payload.items():
        setattr(organization, field, value)

    db.commit()
    db.refresh(organization)

    return organization

@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Delete an organization.

    - Admin: can delete any organization
    - Coach: can delete organizations they have access to, but only if
      no users with MANAGER role are assigned to the organization.
    """
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    if current_user.role == UserRole.COACH:
        # Check coach has access to this org
        has_access = (current_user.organization_id == organization_id)
        if not has_access:
            access = db.query(OrganizationAccess).filter(
                OrganizationAccess.user_id == current_user.id,
                OrganizationAccess.organization_id == organization_id
            ).first()
            has_access = access is not None

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this organization"
            )

        # Coach cannot delete org if any MANAGER is assigned
        manager_count = db.query(User).filter(
            User.organization_id == organization_id,
            User.role == UserRole.MANAGER
        ).count()
        if manager_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete organization with assigned managers. Remove or reassign managers first."
            )

    db.delete(organization)
    db.commit()


@router.post("/{organization_id}/upgrade", response_model=OrganizationResponse)
def upgrade_organization(
    organization_id: int,
    data: OrganizationUpgradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Upgrade a personal workspace to a full organization.
    - Caller must be an admin of that organization
    - 400 if already a normal organization (is_workspace is False)
    - 403 if organization belongs to a coach (coach workspaces cannot be upgraded)
    - Success: sets name = data.name.strip(), is_workspace = False, name_confirmed = True
    """
    if not check_org_access(db, current_user, organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )

    coach_owner = db.query(User).filter(
        User.organization_id == organization_id,
        User.role == UserRole.COACH
    ).first()
    if coach_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coach workspaces cannot be converted into client organizations"
        )

    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    if not organization.is_workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization is already a full organization"
        )

    new_name = data.name.strip()
    if not new_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name cannot be empty"
        )

    organization.name = new_name
    organization.is_workspace = False
    organization.name_confirmed = True

    db.commit()
    db.refresh(organization)
    return organization

