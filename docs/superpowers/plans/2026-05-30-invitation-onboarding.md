# Invitation & Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-email on invite, invitation status badges (Invited/Active/Expired), resend button, org-level email language, and a first-login onboarding screen.

**Architecture:** Two Alembic migrations add `organizations.language` and `users.invited_at`. The email service gains bilingual support; the ghost invite endpoint wires the email send. A new `POST /api/users/{id}/resend-invitation` endpoint handles resend. The team matrix endpoint is extended to include invitation status. Frontend adds status badges, resend button, org language switcher in the org detail page, and a new `/dashboard/onboarding` page triggered by a one-shot cookie set after join.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), Next.js + next-intl (frontend), smtplib / Gmail SMTP (email)

---

## File Map

**Create:**
- `backend/alembic/versions/l6m7n8o9p0q1_add_language_to_organization.py`
- `backend/alembic/versions/m7n8o9p0q1r2_add_invited_at_to_user.py`
- `backend/tests/test_invitations.py`
- `frontend/app/(dashboard)/dashboard/onboarding/page.tsx`

**Modify:**
- `backend/models.py` — `Organization.language`, `User.invited_at`
- `backend/schemas.py` — `OrganizationUpdate`, `OrganizationResponse`, `PresentationMember`
- `backend/services/email_service.py` — bilingual `send_invitation_email()`
- `backend/routers/invitations.py` — wire email, set `invited_at`, add `compute_invitation_status`
- `backend/routers/teams.py` — populate `is_ghost`, `invited_at`, `invitation_status` in matrix
- `backend/routers/users.py` — new `POST /{user_id}/resend-invitation` endpoint
- `frontend/lib/api.ts` — `Organization`, `OrganizationUpdateData`, `TeamMember` types; `api.invitations.resend`
- `frontend/messages/pl.json` — add `invitations`, `onboarding` namespaces
- `frontend/messages/en.json` — add `invitations`, `onboarding` namespaces
- `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` — status badges + resend button
- `frontend/app/(dashboard)/dashboard/organizations/[id]/page.tsx` — org language switcher
- `frontend/app/(auth)/join/page.tsx` — set `onboarding` cookie, redirect to `/dashboard/onboarding`

---

### Task 1: Alembic migration — `organizations.language`

**Files:**
- Create: `backend/alembic/versions/l6m7n8o9p0q1_add_language_to_organization.py`

- [ ] **Step 1: Write the migration file**

```python
# backend/alembic/versions/l6m7n8o9p0q1_add_language_to_organization.py
"""Add language field to Organization model

Revision ID: l6m7n8o9p0q1
Revises: k5f6g7h8i9j0
Create Date: 2026-05-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l6m7n8o9p0q1'
down_revision: Union[str, None] = 'k5f6g7h8i9j0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'organizations' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('organizations')]
        if 'language' not in columns:
            op.add_column('organizations', sa.Column(
                'language', sa.String(10), nullable=False, server_default='pl'
            ))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'organizations' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('organizations')]
        if 'language' in columns:
            op.drop_column('organizations', 'language')
```

- [ ] **Step 2: Verify migration is syntactically valid**

```bash
cd backend && python -c "import alembic.versions.l6m7n8o9p0q1_add_language_to_organization; print('OK')"
```

Expected: `OK`

---

### Task 2: Alembic migration — `users.invited_at`

**Files:**
- Create: `backend/alembic/versions/m7n8o9p0q1r2_add_invited_at_to_user.py`

- [ ] **Step 1: Write the migration file**

```python
# backend/alembic/versions/m7n8o9p0q1r2_add_invited_at_to_user.py
"""Add invited_at field to User model

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-05-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'm7n8o9p0q1r2'
down_revision: Union[str, None] = 'l6m7n8o9p0q1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'users' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'invited_at' not in columns:
            op.add_column('users', sa.Column(
                'invited_at', sa.DateTime(timezone=True), nullable=True
            ))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'users' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'invited_at' in columns:
            op.drop_column('users', 'invited_at')
```

- [ ] **Step 2: Verify migration is syntactically valid**

```bash
cd backend && python -c "import alembic.versions.m7n8o9p0q1r2_add_invited_at_to_user; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit migrations**

```bash
git add backend/alembic/versions/l6m7n8o9p0q1_add_language_to_organization.py \
        backend/alembic/versions/m7n8o9p0q1r2_add_invited_at_to_user.py
git commit -m "feat: add organizations.language and users.invited_at migrations"
```

---

### Task 3: Update models.py

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add `language` column to `Organization` model**

In `backend/models.py`, find the `Organization` class. After `updated_at`:

```python
# Before (ends at):
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    users = relationship(...)
```

```python
# After:
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    language = Column(String(10), nullable=False, default="pl")

    # Relationships
    users = relationship(...)
```

- [ ] **Step 2: Add `invited_at` column to `User` model**

In `backend/models.py`, find the `User` class. After `language = Column(String(10), ...)`:

```python
# Before:
    language = Column(String(10), nullable=False, default="pl")

    # Public profile (wizytówka)
```

```python
# After:
    language = Column(String(10), nullable=False, default="pl")
    invited_at = Column(DateTime(timezone=True), nullable=True)

    # Public profile (wizytówka)
```

- [ ] **Step 3: Verify models import cleanly**

```bash
cd backend && python -c "from models import Organization, User; print(Organization.language, User.invited_at)"
```

Expected: two SQLAlchemy column objects printed, no error.

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat: add Organization.language and User.invited_at model fields"
```

---

### Task 4: Update schemas.py

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Add `language` to `OrganizationUpdate` and `OrganizationResponse`**

In `OrganizationUpdate` (around line 34), add at the end:

```python
class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)
    street: Optional[str] = Field(default=None, max_length=255)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=120)
    tax_id: Optional[str] = Field(default=None, max_length=32)
    language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')
```

In `OrganizationResponse` (around line 50), add `language`:

```python
class OrganizationResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    tax_id: Optional[str] = None
    language: str = "pl"
    created_at: datetime
    teams: Optional[List[OrganizationTeamSimple]] = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Update `PresentationMember` schema**

Find `PresentationMember` (around line 727) and add the three new fields:

```python
class PresentationMember(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    is_leader: bool = False
    is_ghost: bool = False
    invited_at: Optional[datetime] = None
    invitation_status: str = "active"
    results: List[PresentationTalentResult]
```

- [ ] **Step 3: Verify schemas import cleanly**

```bash
cd backend && python -c "from schemas import OrganizationUpdate, OrganizationResponse, PresentationMember; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add language to org schemas; invitation status fields to PresentationMember"
```

---

### Task 5: Bilingual email service

**Files:**
- Modify: `backend/services/email_service.py`

- [ ] **Step 1: Update `send_invitation_email` signature and body**

Replace the existing `send_invitation_email` function (lines 56-96) with:

```python
def send_invitation_email(
    to_email: str,
    full_name: str,
    invite_token: str,
    team_name: str,
    org_name: str = "",
    language: str = "pl",
):
    """
    Send invitation email in PL or EN based on organization language setting.
    """
    frontend_url = getattr(settings, "frontend_url", "http://localhost:3000").rstrip("/")
    accept_link = f"{frontend_url}/join?token={invite_token}"

    org_label = org_name or team_name

    subjects = {
        "pl": f"Zaproszenie do {org_label} na TalentPilot",
        "en": f"You're invited to join {org_label} on TalentPilot",
    }

    html_bodies = {
        "pl": f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #7c3aed;">TalentPilot</h2>
            </div>
            <p>Witaj, <strong>{full_name}</strong>,</p>
            <p>Zostałeś/aś zaproszony/a do zespołu <strong>{team_name}</strong> w organizacji <strong>{org_label}</strong> w aplikacji <strong>TalentPilot</strong>.</p>
            <p>Kliknij poniższy przycisk, aby aktywować konto i ustawić hasło:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{accept_link}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Aktywuj konto</a>
            </p>
            <p>Jeśli przycisk nie działa, skopiuj poniższy link i wklej go do przeglądarki:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;"><a href="{accept_link}">{accept_link}</a></p>
            <p style="color: #888; font-size: 13px;">Link jest ważny przez 7 dni.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">Wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.</p>
        </body>
    </html>
    """,
        "en": f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #7c3aed;">TalentPilot</h2>
            </div>
            <p>Hi, <strong>{full_name}</strong>,</p>
            <p>You've been invited to the team <strong>{team_name}</strong> in <strong>{org_label}</strong> on <strong>TalentPilot</strong>.</p>
            <p>Click the button below to activate your account and set your password:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{accept_link}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate account</a>
            </p>
            <p>If the button doesn't work, copy this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;"><a href="{accept_link}">{accept_link}</a></p>
            <p style="color: #888; font-size: 13px;">This link is valid for 7 days.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">This message was generated automatically. Please do not reply.</p>
        </body>
    </html>
    """,
    }

    lang = language if language in html_bodies else "pl"
    email_service.send_email(to_email, subjects[lang], html_bodies[lang])
```

- [ ] **Step 2: Verify email service imports cleanly**

```bash
cd backend && python -c "from services.email_service import send_invitation_email; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/email_service.py
git commit -m "feat: bilingual invitation email (PL/EN) with org_name parameter"
```

---

### Task 6: Wire email in invitations router + compute_invitation_status

**Files:**
- Modify: `backend/routers/invitations.py`
- Create: `backend/tests/test_invitations.py`

- [ ] **Step 1: Write failing tests for invitation flow**

Create `backend/tests/test_invitations.py`:

```python
"""Tests for invitation flow: ghost invite creates user + sends email + sets invited_at."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone

from models import Organization, Team, User, UserRole, InvitationStatus
from auth import create_access_token, hash_password


@pytest.fixture
def test_org(db_session):
    org = Organization(name="Test Org", language="pl")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def test_team(db_session, test_org):
    team = Team(name="Test Team", organization_id=test_org.id)
    db_session.add(team)
    db_session.commit()
    db_session.refresh(team)
    return team


@pytest.fixture
def coach(db_session, test_org):
    user = User(
        email="coach@example.com",
        hashed_password=hash_password("password123"),
        full_name="Coach User",
        role=UserRole.COACH,
        organization_id=test_org.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def coach_headers(coach):
    token = create_access_token({"sub": str(coach.id)})
    return {"Authorization": f"Bearer {token}"}


@patch("routers.invitations.send_invitation_email")
def test_ghost_invite_sends_email(mock_send, client, coach_headers, test_team, db_session):
    """Ghost invite endpoint sends an email and sets invited_at."""
    response = client.post(
        "/api/invitations/ghost",
        json={
            "email": "newmember@example.com",
            "full_name": "New Member",
            "team_id": test_team.id,
        },
        headers=coach_headers,
    )
    assert response.status_code == 201
    mock_send.assert_called_once()
    call_kwargs = mock_send.call_args
    assert call_kwargs.kwargs["to_email"] == "newmember@example.com"
    assert call_kwargs.kwargs["language"] in ("pl", "en")

    # invited_at is set on the ghost user
    data = response.json()
    user = db_session.query(User).filter(User.id == data["user_id"]).first()
    assert user.invited_at is not None


@patch("routers.invitations.send_invitation_email")
def test_ghost_invite_uses_org_language(mock_send, client, coach_headers, test_team, db_session):
    """Email is sent in the organization's language."""
    # Set org language to EN
    org = db_session.query(Organization).filter(Organization.id == test_team.organization_id).first()
    org.language = "en"
    db_session.commit()

    client.post(
        "/api/invitations/ghost",
        json={"email": "en@example.com", "full_name": "EN User", "team_id": test_team.id},
        headers=coach_headers,
    )
    call_kwargs = mock_send.call_args
    assert call_kwargs.kwargs["language"] == "en"


def test_compute_invitation_status_active():
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = True
        invited_at = None

    assert compute_invitation_status(FakeUser()) == "active"


def test_compute_invitation_status_invited():
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = False
        invited_at = datetime.now(timezone.utc) - timedelta(days=2)

    assert compute_invitation_status(FakeUser()) == "invited"


def test_compute_invitation_status_expired():
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = False
        invited_at = datetime.now(timezone.utc) - timedelta(days=8)

    assert compute_invitation_status(FakeUser()) == "expired"


def test_compute_invitation_status_no_invited_at():
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = False
        invited_at = None

    assert compute_invitation_status(FakeUser()) == "invited"
```

- [ ] **Step 2: Run tests — verify they fail (import error expected for `compute_invitation_status`)**

```bash
cd backend && python -m pytest tests/test_invitations.py -v 2>&1 | head -30
```

Expected: FAIL — `ImportError: cannot import name 'compute_invitation_status'` or similar.

- [ ] **Step 3: Add `compute_invitation_status` and wire email in `invitations.py`**

At the top of `backend/routers/invitations.py`, add the import after existing imports:

```python
from services.email_service import send_invitation_email
```

Add the helper function before `_hash_token`:

```python
def compute_invitation_status(user) -> str:
    """Compute invitation_status from user fields. Pure function — no DB access."""
    if user.is_active:
        return "active"
    if user.invited_at and user.invited_at < datetime.now(timezone.utc) - timedelta(days=7):
        return "expired"
    return "invited"
```

In `create_ghost_invite`, after `db.commit()` and `db.refresh(invitation)`, add:

```python
    # Send invitation email and record send time
    org = team.organization
    send_invitation_email(
        to_email=user.email,
        full_name=user.full_name,
        invite_token=invite_token,
        team_name=team.name,
        org_name=org.name,
        language=org.language if hasattr(org, "language") else "pl",
    )
    user.invited_at = datetime.now(timezone.utc)
    db.commit()
```

Place this block between `db.refresh(invitation)` and `return GhostInviteResponse(...)`.

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && python -m pytest tests/test_invitations.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/invitations.py backend/tests/test_invitations.py
git commit -m "feat: auto-send invitation email on ghost invite, add compute_invitation_status"
```

---

### Task 7: Extend team matrix with invitation status

**Files:**
- Modify: `backend/routers/teams.py`

- [ ] **Step 1: Import `compute_invitation_status` in teams router**

At the top of `backend/routers/teams.py`, add to the imports section:

```python
from routers.invitations import compute_invitation_status
```

- [ ] **Step 2: Populate ghost/status fields in `get_team_matrix`**

Find the `presentation_members.append(PresentationMember(...))` block (around line 269). Replace it with:

```python
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
```

- [ ] **Step 3: Verify the teams router imports cleanly**

```bash
cd backend && python -c "from routers.teams import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Run test suite**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: no failures.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/teams.py
git commit -m "feat: include is_ghost, invited_at, invitation_status in team matrix response"
```

---

### Task 8: Resend invitation endpoint

**Files:**
- Modify: `backend/routers/users.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_invitations.py`:

```python
@patch("routers.users.send_invitation_email")
def test_resend_invitation(mock_send, client, db_session, test_org, test_team, coach_headers):
    """Resend endpoint re-sends email and resets invited_at."""
    import secrets, hashlib
    from models import TeamInvitation, InvitationStatus
    from datetime import datetime, timedelta, timezone

    # Create a ghost user with an old invited_at
    ghost = User(
        email="ghost@example.com",
        hashed_password="x",
        full_name="Ghost User",
        role=UserRole.USER,
        is_active=False,
        is_ghost=True,
        organization_id=test_org.id,
        invited_at=datetime.now(timezone.utc) - timedelta(days=10),
    )
    db_session.add(ghost)
    db_session.flush()
    test_team.members.append(ghost)

    token = secrets.token_urlsafe(32)
    inv = TeamInvitation(
        user_id=ghost.id,
        team_id=test_team.id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        status=InvitationStatus.ACTIVE,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        created_by=None,
    )
    db_session.add(inv)
    db_session.commit()

    old_invited_at = ghost.invited_at

    response = client.post(
        f"/api/users/{ghost.id}/resend-invitation",
        headers=coach_headers,
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    mock_send.assert_called_once()

    db_session.refresh(ghost)
    assert ghost.invited_at > old_invited_at


@patch("routers.users.send_invitation_email")
def test_resend_invitation_not_ghost(mock_send, client, db_session, test_org, coach_headers):
    """Resend endpoint returns 400 if user is not a ghost."""
    active_user = User(
        email="active@example.com",
        hashed_password="x",
        full_name="Active User",
        role=UserRole.USER,
        is_active=True,
        is_ghost=False,
        organization_id=test_org.id,
    )
    db_session.add(active_user)
    db_session.commit()

    response = client.post(
        f"/api/users/{active_user.id}/resend-invitation",
        headers=coach_headers,
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
cd backend && python -m pytest tests/test_invitations.py::test_resend_invitation tests/test_invitations.py::test_resend_invitation_not_ghost -v 2>&1 | head -20
```

Expected: FAIL — endpoint not found (404).

- [ ] **Step 3: Add the resend endpoint to `users.py`**

Add import at top of `backend/routers/users.py` (find the `send_team_added_email` import and add alongside):

```python
from services.email_service import send_team_added_email, send_invitation_email
```

Add the endpoint at the bottom of `backend/routers/users.py` (after `replace_user`):

```python
@router.post("/{user_id}/resend-invitation", status_code=status.HTTP_200_OK)
def resend_invitation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "manager", "coach"])),
):
    """Resend invitation email to a ghost user. Resets invited_at."""
    from datetime import datetime, timezone
    from models import TeamInvitation, InvitationStatus
    import secrets

    ghost = db.query(User).filter(User.id == user_id).first()
    if not ghost:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not ghost.is_ghost or ghost.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a pending ghost invite")
    if not check_org_access(db, current_user, ghost.organization_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Find active invitation to get team info
    invitation = (
        db.query(TeamInvitation)
        .filter(
            TeamInvitation.user_id == ghost.id,
            TeamInvitation.status == InvitationStatus.ACTIVE,
        )
        .first()
    )
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active invitation found")

    from models import Team
    team = db.query(Team).filter(Team.id == invitation.team_id).first()
    org = team.organization if team else None

    # Regenerate token (extend expiry)
    import hashlib
    from datetime import timedelta
    new_token = secrets.token_urlsafe(32)
    invitation.token_hash = hashlib.sha256(new_token.encode("utf-8")).hexdigest()
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    ghost.invited_at = datetime.now(timezone.utc)
    db.commit()

    send_invitation_email(
        to_email=ghost.email,
        full_name=ghost.full_name,
        invite_token=new_token,
        team_name=team.name if team else "",
        org_name=org.name if org else "",
        language=org.language if org and hasattr(org, "language") else "pl",
    )

    return {"ok": True}
```

- [ ] **Step 4: Run the new tests — verify they pass**

```bash
cd backend && python -m pytest tests/test_invitations.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: no failures.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/users.py backend/tests/test_invitations.py
git commit -m "feat: POST /api/users/{id}/resend-invitation endpoint"
```

---

### Task 9: Update frontend API types

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add `language` to `Organization` and `OrganizationUpdateData` interfaces**

Find `export interface Organization` (around line 32) and add `language`:

```typescript
export interface Organization {
    id: number;
    name: string;
    address?: string;
    street?: string;
    postal_code?: string;
    city?: string;
    tax_id?: string;
    language?: string;
    created_at: string;
}
```

Find `export interface OrganizationUpdateData` (around line 51) and add `language`:

```typescript
export interface OrganizationUpdateData {
    name?: string;
    address?: string;
    street?: string;
    postal_code?: string;
    city?: string;
    tax_id?: string;
    language?: string;
}
```

- [ ] **Step 2: Add invitation fields to `TeamMember` in teams page**

Note: the team page defines its own local `TeamMember` interface (not in api.ts). The `PresentationMember` schema now returns `is_ghost`, `invited_at`, `invitation_status`. The team page maps these from `matrixData.members`. Update the local `interface TeamMember` in `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` (around line 27):

```typescript
interface TeamMember {
    id: string | number;
    name: string;
    email?: string;
    role?: string;
    is_leader?: boolean;
    is_ghost?: boolean;
    invited_at?: string | null;
    invitation_status?: string;
    results: MemberResult[];
}
```

- [ ] **Step 3: Add `resendInvitation` to `api.invitations`**

Find `invitations:` section (around line 604) in `frontend/lib/api.ts`. The existing section has `createGhostInvite` and `acceptInvite`. Add `resendInvitation` after `acceptInvite` (keep both existing methods):

```typescript
        resendInvitation: async (userId: number): Promise<{ ok: boolean }> => {
            const response = await apiClient.post<{ ok: boolean }>(`/api/users/${userId}/resend-invitation`);
            return response.data;
        },
```

Insert this before the closing `},` of the `invitations:` object.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or pre-existing errors only — none newly introduced).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api.ts frontend/app/\(dashboard\)/dashboard/teams/\[id\]/page.tsx
git commit -m "feat: add invitation fields and resendInvitation to frontend API types"
```

---

### Task 10: Add i18n keys for invitations and onboarding

**Files:**
- Modify: `frontend/messages/pl.json`
- Modify: `frontend/messages/en.json`

- [ ] **Step 1: Add `invitations` and `onboarding` keys to `pl.json`**

Before the final closing `}` of `pl.json`, after `"talentImport": {...}`, add:

```json
  "invitations": {
    "resend": "Wyślij ponownie",
    "sending": "Wysyłanie...",
    "resendSuccess": "Email wysłany ponownie",
    "resendError": "Nie udało się wysłać emaila",
    "status": {
      "active": "Aktywny",
      "invited": "Zaproszony",
      "expired": "Wygasł"
    },
    "invitedDaysAgo": "{days, plural, one {# dzień temu} few {# dni temu} many {# dni temu} other {# dni temu}}",
    "orgLanguage": {
      "title": "Język zaproszeń",
      "description": "Język w którym nowi członkowie otrzymają zaproszenie email."
    }
  },
  "onboarding": {
    "title": "Witaj w TalentPilot!",
    "subtitle": "Twój zespół: {teamName}",
    "step1Title": "Wgraj raport Gallup PDF",
    "step1Cta": "Przejdź do Moich Talentów",
    "step2Title": "Zobacz talenty swojego zespołu",
    "step2Cta": "Przejdź do Zespołu",
    "step3Title": "Zapytaj AI o swoje talenty",
    "step3Cta": "Przejdź do Q&A",
    "cta": "Zacznij"
  }
```

- [ ] **Step 2: Add matching keys to `en.json`**

In `en.json`, add after `"talentImport": {...}`:

```json
  "invitations": {
    "resend": "Resend",
    "sending": "Sending...",
    "resendSuccess": "Email resent successfully",
    "resendError": "Failed to resend email",
    "status": {
      "active": "Active",
      "invited": "Invited",
      "expired": "Expired"
    },
    "invitedDaysAgo": "{days, plural, one {# day ago} other {# days ago}}",
    "orgLanguage": {
      "title": "Invitation language",
      "description": "Language in which new members receive their invitation email."
    }
  },
  "onboarding": {
    "title": "Welcome to TalentPilot!",
    "subtitle": "Your team: {teamName}",
    "step1Title": "Upload your Gallup PDF report",
    "step1Cta": "Go to My Talents",
    "step2Title": "See your team's talents",
    "step2Cta": "Go to Team",
    "step3Title": "Ask AI about your talents",
    "step3Cta": "Go to Q&A",
    "cta": "Get started"
  }
```

- [ ] **Step 3: Verify JSON is valid for both files**

```bash
cd frontend && node -e "JSON.parse(require('fs').readFileSync('messages/pl.json','utf8')); console.log('pl.json OK')"
cd frontend && node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('en.json OK')"
```

Expected: `pl.json OK` and `en.json OK`

- [ ] **Step 4: Commit**

```bash
git add frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat: add invitations and onboarding i18n keys"
```

---

### Task 11: Status badges + resend button in team detail page

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx`

- [ ] **Step 1: Add i18n hook and resend state**

At the top of the component (after existing `useTranslations` hooks), add:

```tsx
const tInv = useTranslations('invitations');
const [resendingId, setResendingId] = useState<string | number | null>(null);
```

- [ ] **Step 2: Add `handleResend` function**

After the existing `handleRemoveMember` function, add:

```tsx
const handleResend = async (memberId: string | number) => {
    setResendingId(memberId);
    try {
        await api.invitations.resendInvitation(parseInt(memberId as string));
        await loadTeamData();
    } catch (err) {
        console.error("Failed to resend invitation", err);
    } finally {
        setResendingId(null);
    }
};
```

- [ ] **Step 3: Add status badge helper**

Before the `return` statement, add:

```tsx
const getStatusBadge = (member: TeamMember) => {
    const status = member.invitation_status ?? 'active';
    const colorMap: Record<string, string> = {
        active: 'bg-green-100 text-green-700',
        invited: 'bg-yellow-100 text-yellow-700',
        expired: 'bg-gray-100 text-gray-500',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorMap[status] ?? colorMap.active}`}>
            {tInv(`status.${status}`)}
        </span>
    );
};
```

- [ ] **Step 4: Add badge and resend button to member rows**

In the member table row (around line 556), find the member name div block and add the badge right after the name line:

```tsx
<div className="font-medium text-slate-900 group-hover/link:text-blue-600 transition-colors flex items-center gap-2">
    {member.name}
    {member.is_leader && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600" title={t('manager')}>
            <Crown className="w-3 h-3" />
        </span>
    )}
</div>
<div className="flex items-center gap-2 mt-0.5">
    <div className="text-sm text-slate-500">{member.email || t('noEmailAddress')}</div>
    {member.is_ghost && getStatusBadge(member)}
</div>
```

In the action buttons column (around line 612), replace the existing `<td className="py-4 px-6 text-right">` block with the version that adds the resend button before the existing crown/edit/delete buttons:

```tsx
<td className="py-4 px-6 text-right">
    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {member.is_ghost && (member.invitation_status === 'invited' || member.invitation_status === 'expired') && (
            <button
                onClick={() => handleResend(member.id)}
                disabled={resendingId === member.id}
                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                title={tInv('resend')}
            >
                {resendingId === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <span className="text-xs font-medium px-1">{tInv('resend')}</span>
                )}
            </button>
        )}
        <button
            onClick={() => toggleLeader(member)}
            className={`p-2 rounded-lg transition-colors ${member.is_leader ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            title={member.is_leader ? t('noManager') : t('manager')}
        >
            <Crown className="w-4 h-4" />
        </button>
        <button
            onClick={() => setEditingMember({ id: member.id, name: member.name, email: member.email || '', role: member.role || '' })}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={tCommon('edit')}
        >
            <Edit2 className="w-4 h-4" />
        </button>
        <button
            onClick={() => handleRemoveMember(parseInt(member.id as string))}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title={t('removeMember')}
        >
            <Trash2 className="w-4 h-4" />
        </button>
    </div>
</td>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(dashboard\)/dashboard/teams/\[id\]/page.tsx
git commit -m "feat: invitation status badge and resend button on team member list"
```

---

### Task 12: Organization language switcher

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/organizations/[id]/page.tsx`

- [ ] **Step 1: Add `language` to the local `Organization` interface and state**

Find the `interface Organization` (around line 20) and add `language`:

```typescript
interface Organization {
    id: number;
    name: string;
    street: string | null;
    postal_code: string | null;
    city: string | null;
    tax_id: string | null;
    language: string;
    created_at: string;
}
```

Add state for language (after existing state declarations):

```tsx
const [orgLang, setOrgLang] = useState<'pl' | 'en'>('pl');
```

In the `loadData` block where `setOrg(orgData as Organization)` is called, also set the lang:

```tsx
setOrg(orgData as Organization);
setOrgLang((orgData as Organization).language as 'pl' | 'en' ?? 'pl');
```

- [ ] **Step 2: Add `handleOrgLangChange` function**

After `handleSaveOrg`, add:

```tsx
const handleOrgLangChange = async (lang: 'pl' | 'en') => {
    try {
        const updated = await api.organizations.update(id, { language: lang });
        setOrg(updated as Organization);
        setOrgLang(lang);
    } catch (err) {
        console.error("Failed to update org language:", err);
    }
};
```

- [ ] **Step 3: Add language switcher UI section**

Find the `useTranslations` hook and add an invitations translation:

```tsx
const tInv = useTranslations('invitations');
```

In the JSX, after the organization info section (after the address card or before teams list), add:

```tsx
{/* Invitation Language */}
<div className="bg-white rounded-xl border border-slate-200 p-6">
    <h3 className="text-sm font-semibold text-slate-900 mb-1">{tInv('orgLanguage.title')}</h3>
    <p className="text-sm text-slate-500 mb-4">{tInv('orgLanguage.description')}</p>
    <div className="flex gap-2">
        <Button
            variant={orgLang === 'pl' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleOrgLangChange('pl')}
        >
            Polski
        </Button>
        <Button
            variant={orgLang === 'en' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleOrgLangChange('en')}
        >
            English
        </Button>
    </div>
</div>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(dashboard\)/dashboard/organizations/\[id\]/page.tsx
git commit -m "feat: org language switcher for invitation emails"
```

---

### Task 13: Onboarding page

**Files:**
- Create: `frontend/app/(dashboard)/dashboard/onboarding/page.tsx`

- [ ] **Step 1: Create the onboarding page**

```tsx
// frontend/app/(dashboard)/dashboard/onboarding/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";
import { ArrowRight, FileText, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_COOKIE = "onboarding";

function getOnboardingCookie(): boolean {
    if (typeof document === "undefined") return false;
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${ONBOARDING_COOKIE}=`));
}

function clearOnboardingCookie() {
    document.cookie = `${ONBOARDING_COOKIE}=; path=/; max-age=0`;
}

export default function OnboardingPage() {
    const t = useTranslations("onboarding");
    const router = useRouter();
    const [teamName, setTeamName] = useState("");
    const [userName, setUserName] = useState("");

    useEffect(() => {
        // Guard: if no onboarding cookie, redirect to dashboard
        if (!getOnboardingCookie()) {
            router.replace("/dashboard");
            return;
        }

        const user = tokenManager.getUser();
        if (user?.full_name) setUserName(user.full_name.split(" ")[0]);

        api.teams.list().then((teams) => {
            if (teams.length > 0) setTeamName(teams[0].name);
        });
    }, [router]);

    const handleGetStarted = () => {
        clearOnboardingCookie();
        router.push("/dashboard");
    };

    const steps = [
        {
            icon: <FileText className="w-6 h-6 text-purple-600" />,
            title: t("step1Title"),
            cta: t("step1Cta"),
            href: "/dashboard/my-talents",
        },
        {
            icon: <Users className="w-6 h-6 text-blue-600" />,
            title: t("step2Title"),
            cta: t("step2Cta"),
            href: "/dashboard/teams",
        },
        {
            icon: <MessageSquare className="w-6 h-6 text-green-600" />,
            title: t("step3Title"),
            cta: t("step3Cta"),
            href: "/dashboard/qa",
        },
    ];

    return (
        <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-slate-50">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {t("title")}
                    </h1>
                    {teamName && (
                        <p className="text-slate-500 text-lg">
                            {t("subtitle", { teamName })}
                        </p>
                    )}
                </div>

                <div className="space-y-4 mb-8">
                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                    {step.icon}
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-800">{i + 1}. {step.title}</div>
                                </div>
                            </div>
                            <Link
                                href={step.href}
                                className="text-sm font-medium text-purple-600 hover:text-purple-700 whitespace-nowrap flex items-center gap-1"
                                onClick={clearOnboardingCookie}
                            >
                                {step.cta}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="text-center">
                    <Button onClick={handleGetStarted} size="lg" className="px-8">
                        {t("cta")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(dashboard\)/dashboard/onboarding/page.tsx
git commit -m "feat: /dashboard/onboarding welcome screen for new users"
```

---

### Task 14: Update join page to redirect to onboarding

**Files:**
- Modify: `frontend/app/(auth)/join/page.tsx`

- [ ] **Step 1: Add onboarding cookie setter**

In `frontend/app/(auth)/join/page.tsx`, in the `handleSubmit` function, replace:

```tsx
            // Redirect to dashboard
            router.push("/dashboard");
```

with:

```tsx
            // Set one-time onboarding cookie and redirect to onboarding
            document.cookie = "onboarding=1; path=/; max-age=300; SameSite=Lax";
            router.push("/dashboard/onboarding");
```

The `max-age=300` (5 minutes) means the cookie auto-expires if the user doesn't land on the onboarding page, preventing it from appearing unexpectedly on a future visit.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(auth\)/join/page.tsx
git commit -m "feat: redirect newly joined users to /dashboard/onboarding"
```

---

## Testing Checklist

After all tasks are complete, manually verify:

- [ ] Create a ghost invite in team view → check that the invitation email is sent (check SMTP logs or use a test email address)
- [ ] Team member list shows yellow "Zaproszony/Invited" badge next to ghost users
- [ ] Hover over a ghost member row → resend button appears → click it → email sent, `invited_at` updated
- [ ] Change org language to EN in `/dashboard/organizations/[id]` → next ghost invite sends email in English
- [ ] Open `/join?token=...` link, set password → land on `/dashboard/onboarding` (not dashboard)
- [ ] Click "Zacznij/Get Started" on onboarding → land on `/dashboard`, onboarding cookie gone
- [ ] Navigate directly to `/dashboard/onboarding` without cookie → redirect to `/dashboard`
- [ ] Coach opens team page after user joined → member badge shows green "Aktywny/Active"
- [ ] Run backend test suite: `cd backend && python -m pytest tests/ -v`
