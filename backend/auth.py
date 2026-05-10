"""Authentication utilities for JWT tokens and password hashing."""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User, ApiKey

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token
security = HTTPBearer()

# API Key token
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plain password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary of claims to encode in the token
        expires_delta: Optional expiration time delta
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expiration_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and validate JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user.
    
    Usage:
        @app.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            return {"user": current_user.email}
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    try:
        user_id = int(raw_sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    
    return user


def require_role(allowed_roles: list):
    """
    Dependency factory for role-based access control.
    
    Usage:
        @app.delete("/users/{user_id}")
        def delete_user(
            user_id: int,
            current_user: User = Depends(require_role(["admin"]))
        ):
            # Only admins can access this
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}",
            )
        return current_user
    
    return role_checker


def verify_api_key(
    api_key: str = Depends(api_key_header),
    db: Session = Depends(get_db)
) -> ApiKey:
    """Validate external API key."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    
    key_record = db.query(ApiKey).filter(ApiKey.key == api_key, ApiKey.is_active == True).first()
    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or inactive API Key",
        )
    
    return key_record


def get_current_active_org_id(
    x_organization_id: Optional[int] = Header(None, alias="X-Organization-Id"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> int:
    """
    Returns the active organization ID for the request.
    - If X-Organization-Id is provided, checks if user has access.
    - If not provided, defaults to user's main organization_id.
    """
    if not x_organization_id:
        return current_user.organization_id
        
    if x_organization_id == current_user.organization_id:
        return x_organization_id
        
    # Check if coach/admin has cross-org access
    if current_user.role.value in ["coach", "admin"]:
        from models import OrganizationAccess
        access = db.query(OrganizationAccess).filter(
            OrganizationAccess.user_id == current_user.id,
            OrganizationAccess.organization_id == x_organization_id
        ).first()
        if access:
            return x_organization_id
            
    # Deny access
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this organization context"
    )


def check_org_access(db: Session, user: User, organization_id: int) -> bool:
    """
    Check if a user has access to the given organization.

    Returns True if:
    - User is ADMIN (full access)
    - organization_id matches user's home organization
    - User is COACH with OrganizationAccess record for that org

    This is a read-only check — does NOT raise exceptions.
    """
    from models import UserRole, OrganizationAccess

    if user.role == UserRole.ADMIN:
        return True
    if user.organization_id == organization_id:
        return True
    if user.role == UserRole.COACH:
        access = db.query(OrganizationAccess).filter(
            OrganizationAccess.user_id == user.id,
            OrganizationAccess.organization_id == organization_id
        ).first()
        return access is not None
    return False
