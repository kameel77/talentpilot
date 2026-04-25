"""Organizations router for CRUD operations."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Organization
from schemas import OrganizationCreate, OrganizationUpdate, OrganizationResponse
from auth import get_current_user, require_role

router = APIRouter()


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Create a new organization (admin or coach)."""
    organization = Organization(
        name=data.name,
        street=data.street,
        postal_code=data.postal_code,
        city=data.city,
        tax_id=data.tax_id,
    )
    db.add(organization)
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

    - Users can only access their own organization
    """
    # Check if user belongs to this organization
    if current_user.organization_id != organization_id:
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
    current_user: User = Depends(require_role(["manager"])),
):
    """Update organization details. Manager-only and limited to their own organization."""
    if current_user.organization_id != organization_id:
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
    for field, value in payload.items():
        setattr(organization, field, value)

    db.commit()
    db.refresh(organization)

    return organization
