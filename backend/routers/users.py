"""Users router for CRUD operations."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import User, UserRole
from schemas import UserCreate, UserUpdate, UserResponse, UserDetailResponse, PasswordChangeRequest
from auth import get_current_user, require_role, hash_password, verify_password

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager"]))
):
    """
    Add user to organization (admin or manager).
    
    - User belongs to current user's organization
    - Only admins can create other admins
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Only admins can create admin users
    if data.role == UserRole.ADMIN and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create admin users"
        )
    
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        organization_id=current_user.organization_id,
        public_token=str(uuid.uuid4()).replace("-", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.get("", response_model=List[UserResponse])
def list_users(
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List users in organization.
    
    - Optional filter by team
    - Users see only users in their organization
    """
    query = db.query(User).filter(User.organization_id == current_user.organization_id)
    
    if team_id is not None:
        # Filter by team
        from models import user_teams
        query = query.join(user_teams).filter(user_teams.c.team_id == team_id)
    
    users = query.all()
    return users


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get user details with User Manual fields.
    
    - Users can view users in their organization
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access
    if user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    return user


@router.patch("/{user_id}", response_model=UserDetailResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update user profile.
    
    - Users can update their own profile (User Manual fields)
    - Admins can update any user in their organization
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Users can only edit their own profile, admins can edit anyone
    if current_user.role != UserRole.ADMIN and user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own profile"
        )
    
    # Update fields
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        existing = db.query(User).filter(User.email == data.email, User.id != user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = data.email
    if data.phone is not None:
        user.phone = data.phone
    if data.linkedin_url is not None:
        user.linkedin_url = data.linkedin_url
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    if data.superpowers is not None:
        user.superpowers = data.superpowers
    if data.motivators is not None:
        user.motivators = data.motivators
    if data.blockers is not None:
        user.blockers = data.blockers
    if data.feedback_style is not None:
        user.feedback_style = data.feedback_style
    if data.public_profile_settings is not None:
        user.public_profile_settings = data.public_profile_settings
    if data.public_slug is not None:
        slug = data.public_slug.lower().strip()
        conflict = db.query(User).filter(User.public_slug == slug, User.id != user.id).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This slug is already taken. Please choose a different one.",
            )
        user.public_slug = slug
    if data.is_active is not None:
        # Only admins can toggle is_active
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can activate/deactivate users",
            )
        # Prevent self-deactivation
        if user.id == current_user.id and data.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account",
            )
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change current user's password."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return None


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """
    Delete user (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access
    if user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(user)
    db.commit()
    
    return None
