"""Authentication router with register, login, and user info endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
import hashlib
from datetime import datetime, timezone, timedelta

from database import get_db
from models import User, Organization, UserRole, PasswordResetToken
from schemas import (
    RegisterRequest,
    Token,
    UserResponse,
    UserDetailResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from services.email_service import send_password_reset_email

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register new organization with first admin user.
    
    - Creates organization
    - Creates admin user
    - Returns JWT token
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create organization
    organization = Organization(name=data.organization_name)
    db.add(organization)
    db.flush()  # Get organization.id
    
    # Create admin user
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.ADMIN,
        organization_id=organization.id,
        public_token=str(uuid.uuid4()).replace("-", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login with email and password.
    
    - Validates credentials
    - Returns JWT token
    """
    try:
        payload = await request.json()
    except Exception:
        form = await request.form()
        payload = dict(form)

    email = payload.get("email") or payload.get("username")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email and password are required",
        )

    # Find user by email
    user = db.query(User).filter(User.email == email).first()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Lazily assign public_token for users who don't have one yet
    if not user.public_token:
        user.public_token = str(uuid.uuid4()).replace("-", "")
        db.commit()
        db.refresh(user)

    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserDetailResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user details.
    
    - Requires valid JWT token
    - Returns user profile with User Manual fields
    """
    return current_user


@router.get("/me/organizations")
def get_my_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all organizations accessible by the current user.
    - Admin: all organizations in the system
    - Coach: home organization + organizations granted via OrganizationAccess
    - Manager/User: home organization only
    """
    if current_user.role.value == "admin":
        all_orgs = db.query(Organization).order_by(Organization.name).all()
        return [{"id": o.id, "name": o.name} for o in all_orgs]

    orgs = [{"id": current_user.organization.id, "name": current_user.organization.name}]

    if current_user.role.value == "coach":
        from models import OrganizationAccess
        access_list = db.query(OrganizationAccess).filter(
            OrganizationAccess.user_id == current_user.id
        ).all()
        for access in access_list:
            if access.organization and access.organization_id != current_user.organization_id:
                orgs.append({"id": access.organization.id, "name": access.organization.name})

    return orgs


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Zgłoszenie prośby o reset hasła. Zwraca zawsze 200 z tym samym komunikatem.
    Wysyła email w tle za pomocą EmailService.
    """
    user = db.query(User).filter(User.email == data.email).first()
    
    # We return the same response regardless if user exists, for security (prevent enumeration)
    response_msg = {"message": "Jeśli podany e-mail istnieje w bazie, wysłaliśmy na niego link do resetu hasła."}
    
    if not user:
        return response_msg
        
    # Tworzymy unikalny token
    reset_token = str(uuid.uuid4())
    # Hashujemy token do bazy
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    # 1 hour expiry
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Inwalidacja starych tokenow dla usera
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
    
    db_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    
    # Zlecamy wysyłkę w tle
    background_tasks.add_task(send_password_reset_email, user.email, reset_token)
    
    return response_msg


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Weryfikuje token i zapisuje nowe hasło.
    """
    token_hash = hashlib.sha256(data.token.encode()).hexdigest()
    
    # Find active token
    db_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Nieprawidłowy lub wygasły link do zmiany hasła."
        )
        
    if db_token.expires_at < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Link do zmiany hasła wygasł."
        )
        
    # Znajdź usera
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Nie znaleziono użytkownika."
        )
        
    # Update hasła
    user.hashed_password = hash_password(data.new_password)
    
    # Kasujemy zużyty token
    db.delete(db_token)
    db.commit()
    
    return {"message": "Hasło zostało pomyślnie zmienione. Możesz się teraz zalogować."}
