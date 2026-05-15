"""Users router for CRUD operations."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import User, UserRole, user_teams, Team, UserTalent
from services.email_service import send_team_added_email
from schemas import UserCreate, UserUpdate, UserResponse, UserDetailResponse, PasswordChangeRequest, AdminRoleUpdate
from auth import get_current_user, require_role, hash_password, verify_password, get_current_active_org_id, check_org_access, check_user_access

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    Add user to organization (admin, manager, or coach).
    
    - User belongs to the active organization context
    - Only admins can create admin or coach users
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Only admins can create admin or coach users
    if data.role in (UserRole.ADMIN, UserRole.COACH) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create admin or coach users"
        )
    
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        organization_id=active_org_id,
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
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
):
    """
    List users in organization.
    
    - Optional filter by team
    - USER role: sees only users from teams they belong to
    - ADMIN/MANAGER/COACH: sees all users in the organization context
    """
    query = db.query(User).filter(User.organization_id == active_org_id)
    
    # USER role: restrict to teammates only
    if current_user.role == UserRole.USER and team_id is None:
        my_team_ids = db.query(user_teams.c.team_id).filter(
            user_teams.c.user_id == current_user.id
        )
        teammate_ids = db.query(user_teams.c.user_id).filter(
            user_teams.c.team_id.in_(my_team_ids)
        )
        query = query.filter(User.id.in_(teammate_ids))
    
    if team_id is not None:
        query = query.join(user_teams).filter(user_teams.c.team_id == team_id)
    
    users = query.all()
    return users


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
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
    
    # Check access — supports cross-org users via shared team membership
    if not check_user_access(db, current_user, user):
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
    current_user: User = Depends(get_current_user),
    active_org_id: int = Depends(get_current_active_org_id)
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
    if not check_org_access(db, current_user, user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user"
        )
    
    # Users can only edit their own profile; admins, coaches, and managers can edit anyone in the org
    if current_user.role not in (UserRole.ADMIN, UserRole.COACH, UserRole.MANAGER) and user.id != current_user.id:
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
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "EMAIL_CONFLICT",
                    "message": "Email already in use",
                    "existing_user": {
                        "id": existing.id,
                        "full_name": existing.full_name,
                        "email": existing.email,
                    }
                }
            )
        user.email = data.email
    if data.phone is not None:
        user.phone = data.phone
    if data.linkedin_url is not None:
        user.linkedin_url = data.linkedin_url
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    if data.job_title is not None:
        user.job_title = data.job_title
    if data.job_title_en is not None:
        user.job_title_en = data.job_title_en
    if data.superpowers is not None:
        user.superpowers = data.superpowers
    if data.motivators is not None:
        user.motivators = data.motivators
    if data.blockers is not None:
        user.blockers = data.blockers
    if data.feedback_style is not None:
        user.feedback_style = data.feedback_style
    if data.superpowers_en is not None:
        user.superpowers_en = data.superpowers_en
    if data.motivators_en is not None:
        user.motivators_en = data.motivators_en
    if data.blockers_en is not None:
        user.blockers_en = data.blockers_en
    if data.feedback_style_en is not None:
        user.feedback_style_en = data.feedback_style_en
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


@router.post("/{user_id}/generate-manual", response_model=dict)
def generate_user_manual(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate User Manual content (superpowers, motivators, blockers, feedback_style)
    using LLM based on the user's top Gallup talents.
    Returns generated text — does NOT save automatically.
    """
    if current_user.id != user_id and current_user.role not in (UserRole.ADMIN, UserRole.COACH):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    from services.assistant_service import get_openrouter_client, get_user_talents
    from services.settings_service import get_setting

    talents = get_user_talents(db, user_id, language="pl")
    if not talents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no talents imported. Import Gallup talents first."
        )

    top5 = [t for t in talents if t["rank"] <= 5]
    talent_list = ", ".join(f"{t['name']} (#{t['rank']})" for t in top5)

    DOMAIN_MAP = {
        "executing": "Realizowanie",
        "influencing": "Wywieranie wpływu",
        "relationship_building": "Budowanie relacji",
        "strategic_thinking": "Myślenie strategiczne",
    }
    domain_summary = {}
    for t in talents[:15]:
        d = DOMAIN_MAP.get(t["domain"], t["domain"])
        domain_summary[d] = domain_summary.get(d, 0) + 1
    domain_str = ", ".join(f"{d}: {c}" for d, c in sorted(domain_summary.items(), key=lambda x: -x[1]))

    # Try to load system prompt from KB "Instrukcja odpowiedzi" (category: user_manual_generation)
    from services.assistant_service import retrieve_instruction
    kb_instruction, _ = retrieve_instruction(db, "user_manual_generation", "pl")

    system_content = kb_instruction or (
        "Jesteś ekspertem od metodologii Gallup CliftonStrengths. "
        "Piszesz 'Instrukcję obsługi' użytkownika — zwięzły, praktyczny opis jak z nim współpracować. "
        "Pisz w pierwszej osobie liczby pojedynczej (np. 'Moja naturalna siła to...'). "
        "Język polski. Odpowiadaj WYŁĄCZNIE poprawnym JSON-em, bez komentarzy, bez markdown."
    )

    user_content = f"""Na podstawie profilu talentów wygeneruj instrukcję obsługi.

TOP 5 TALENTÓW: {talent_list}
ROZKŁAD DOMEN (top 15): {domain_str}

Wygeneruj DOKŁADNIE 4 sekcje w formacie JSON:
{{
  "superpowers": "3-5 zdań o naturalnych mocnych stronach i unikalnej wartości jaką wnosi do zespołu. Konkretnie, oparte na talentach.",
  "motivators": "3-5 zdań o tym co daje tej osobie energię, co ją motywuje, w jakich warunkach działa najlepiej.",
  "blockers": "3-5 zdań o tym co spowalnia, frustruje lub drażni tę osobę — czego unikać we współpracy.",
  "feedback_style": "2-4 zdania jak dawać tej osobie feedback — forma, timing, styl komunikacji."
}}"""

    try:
        import json
        model = get_setting(db, "openrouter_model") or "openai/gpt-4o-mini"
        client = get_openrouter_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ],
            temperature=0.7,
            max_tokens=1200,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "superpowers": result.get("superpowers", ""),
            "motivators": result.get("motivators", ""),
            "blockers": result.get("blockers", ""),
            "feedback_style": result.get("feedback_style", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI generation failed: {str(e)}")


@router.post("/me/translate-profile", response_model=dict)
def translate_user_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Translate user's profile fields to English using LLM.
    Includes CliftonStrengths talent name glossary so the LLM
    uses official English names (e.g. Bliskość → Relator, not Closeness).
    Returns translated text — does NOT save automatically.
    """
    from services.assistant_service import get_openrouter_client, get_user_talents
    from services.settings_service import get_setting
    import json

    # Build PL→EN talent name glossary from the user's actual talents
    talents_pl = get_user_talents(db, current_user.id, language="pl")
    talents_en = get_user_talents(db, current_user.id, language="en")
    # Create rank-keyed lookup for EN names
    en_by_rank = {t["rank"]: t["name"] for t in talents_en}
    glossary_lines = []
    for t in talents_pl:
        en_name = en_by_rank.get(t["rank"], "")
        if en_name:
            glossary_lines.append(f'  "{t["name"]}" → "{en_name}"')

    glossary_block = ""
    if glossary_lines:
        glossary_block = (
            "\n\nCRITICAL — CliftonStrengths Talent Name Glossary:\n"
            "When the Polish text mentions any of the following talent names, "
            "you MUST use the official English name from this glossary. "
            "Do NOT translate talent names literally.\n"
            + "\n".join(glossary_lines)
        )

    system_content = (
        "You are an expert translator specializing in professional business profiles "
        "and Gallup CliftonStrengths methodology. "
        "Translate the following Polish text to English, maintaining a professional SaaS tone. "
        "Keep the first-person singular voice (e.g. 'My natural strength is...'). "
        "Respond ONLY with a valid JSON object, without comments, without markdown blocks."
        + glossary_block
    )

    fields_to_translate = {
        "job_title": current_user.job_title or "",
        "superpowers": current_user.superpowers or "",
        "motivators": current_user.motivators or "",
        "blockers": current_user.blockers or "",
        "feedback_style": current_user.feedback_style or ""
    }

    user_content = f"""Please translate the following fields from Polish to English.
If a field is empty, leave it empty.

{json.dumps(fields_to_translate, ensure_ascii=False, indent=2)}

Return exactly 5 fields in JSON:
{{
  "job_title_en": "translated...",
  "superpowers_en": "translated...",
  "motivators_en": "translated...",
  "blockers_en": "translated...",
  "feedback_style_en": "translated..."
}}"""

    try:
        model = get_setting(db, "openrouter_model") or "openai/gpt-4o-mini"
        client = get_openrouter_client()
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "job_title_en": result.get("job_title_en", ""),
            "superpowers_en": result.get("superpowers_en", ""),
            "motivators_en": result.get("motivators_en", ""),
            "blockers_en": result.get("blockers_en", ""),
            "feedback_style_en": result.get("feedback_style_en", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Translation failed: {str(e)}")


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
    current_user: User = Depends(require_role(["admin", "coach", "manager"])),
    active_org_id: int = Depends(get_current_active_org_id)
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
    if not check_org_access(db, current_user, user.organization_id):
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


@router.patch("/{user_id}/role", response_model=UserDetailResponse)
def update_user_role(
    user_id: int,
    payload: AdminRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
    active_org_id: int = Depends(get_current_active_org_id),
):
    """
    Update user role.

    - Admin: can set any role
    - Coach: can only set USER or MANAGER roles (within accessible orgs)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check organization access
    if not check_org_access(db, current_user, user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this user",
        )

    # Coach can only set USER or MANAGER roles
    if current_user.role == UserRole.COACH:
        if payload.role not in (UserRole.USER, UserRole.MANAGER):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Coach can only set USER or MANAGER roles",
            )

    # Prevent changing own role
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    user.role = payload.role
    db.commit()
    db.refresh(user)

    return user


from pydantic import BaseModel as _BaseModel

class ReplaceUserRequest(_BaseModel):
    existing_user_id: int


@router.post("/{ghost_id}/replace", status_code=status.HTTP_200_OK)
def replace_user(
    ghost_id: int,
    data: ReplaceUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Replace a ghost user with an existing user across ALL teams.

    Transfers talents (ghost's are always treated as newer),
    adds existing user to all ghost's teams, and deletes the ghost.
    """
    ghost_user = db.query(User).filter(User.id == ghost_id).first()
    existing_user = db.query(User).filter(User.id == data.existing_user_id).first()

    if not ghost_user or not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Permission check
    if not check_org_access(db, current_user, ghost_user.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    # 1. Transfer talents from ghost → existing (overwrite — ghost's are newer)
    ghost_talents = db.query(UserTalent).filter(UserTalent.user_id == ghost_user.id).all()
    if ghost_talents:
        db.query(UserTalent).filter(UserTalent.user_id == existing_user.id).delete()
        for ut in ghost_talents:
            ut.user_id = existing_user.id
        db.flush()

    # 2. Transfer manual fields (only if ghost has data and existing doesn't)
    for field in ['superpowers', 'motivators', 'blockers', 'feedback_style',
                  'superpowers_en', 'motivators_en', 'blockers_en', 'feedback_style_en',
                  'job_title', 'job_title_en']:
        ghost_val = getattr(ghost_user, field, None)
        existing_val = getattr(existing_user, field, None)
        if ghost_val and not existing_val:
            setattr(existing_user, field, ghost_val)

    # 3. Find all teams ghost belongs to and add existing user
    ghost_teams = db.query(Team).filter(Team.members.any(User.id == ghost_user.id)).all()
    team_names = []
    for team in ghost_teams:
        if existing_user not in team.members:
            team.members.append(existing_user)
        if team.manager_id == ghost_user.id:
            team.manager_id = existing_user.id
        if ghost_user in team.members:
            team.members.remove(ghost_user)
        team_names.append(team.name)

    # 4. Delete ghost user
    if ghost_user.is_ghost:
        db.delete(ghost_user)
    else:
        ghost_user.is_active = False

    db.commit()

    # 5. Send email notification
    try:
        org_name = ghost_teams[0].organization.name if ghost_teams and ghost_teams[0].organization else "TalentPilot"
        for team in ghost_teams:
            send_team_added_email(
                to_email=existing_user.email,
                full_name=existing_user.full_name,
                team_name=team.name,
                org_name=org_name,
            )
    except Exception:
        pass

    return {
        "message": "User replaced successfully",
        "user": {
            "id": existing_user.id,
            "full_name": existing_user.full_name,
            "email": existing_user.email,
        },
        "talents_transferred": len(ghost_talents) if ghost_talents else 0,
        "teams_joined": team_names,
    }
