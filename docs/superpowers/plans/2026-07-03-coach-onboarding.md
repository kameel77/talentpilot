# Coach Onboarding & Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve coach registration with a private workspace, an onboarding wizard (individual & organizational clients), and a role-scoped UI for the COACH role.

**Architecture:** Backend-first: new `register-coach` endpoint creating a workspace org, ghost invites without a team (individual clients), a move-organization endpoint (pin = move). Then frontend: dedicated signup page, role-branched sidebar/guards, a coach wizard on the existing onboarding route, and a "Klienci" view with an Individuals tab.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + pytest (backend); Next.js + TypeScript + next-intl + axios (frontend).

**Spec:** `docs/superpowers/specs/2026-07-03-coach-onboarding-design.md`

## Global Constraints

- Branch: create `feature/coach-onboarding` from `main` before Task 1; all commits go there.
- Workspace org name format: `"{full_name} — Coaching"` (em-dash, exact).
- Coach's home org (workspace) must NEVER appear in the client switcher or org lists returned to the coach by `/api/auth/me/organizations`.
- Individual clients are NEVER placed in a team inside the workspace (privacy invariant).
- Pin = move: pinning changes `organization_id`; no multi-membership.
- Ghost invite sends NO email (existing behavior — email only via explicit resend-invitation).
- i18n: every new UI string goes to BOTH `frontend/messages/pl.json` and `frontend/messages/en.json`.
- Backend tests: `cd backend && python -m pytest tests/<file> -v` (if `pytest` is missing on PATH, use `../venv/bin/python -m pytest`). Frontend verification: `cd frontend && npm run build` and `npm run lint`.
- Code and comments in English; UI copy in PL + EN message files.

---

### Task 1: `POST /api/auth/register-coach` — self-serve coach signup

**Files:**
- Modify: `backend/schemas.py` (after `RegisterRequest`, ~line 272)
- Modify: `backend/routers/auth.py` (after the `register` endpoint, ~line 69)
- Test: `backend/tests/test_coach_onboarding.py` (create)

**Interfaces:**
- Consumes: existing `Token` schema, `hash_password`, `create_access_token`, `Organization`, `User`, `UserRole` (all already imported in `auth.py`).
- Produces: `POST /api/auth/register-coach` accepting `{email, password, full_name}` → `201 {access_token, token_type}`. Creates `Organization(name=f"{full_name} — Coaching")` + `User(role=UserRole.COACH, organization_id=<workspace.id>)`. Later tasks (2, 3, 4) reuse the test helper `_register_coach(client, email)` defined here.

- [ ] **Step 0: Create the feature branch**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot
git checkout main && git pull && git checkout -b feature/coach-onboarding
```

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_coach_onboarding.py`:

```python
"""Tests for coach self-serve registration, workspace filtering, and client management."""
import pytest

from models import Organization, User, UserRole


def _register_coach(client, email="coach@example.com", full_name="Anna Kowalska"):
    """Helper: register a coach, return (access_token, headers)."""
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


def test_register_coach_creates_workspace_and_coach(client, db_session):
    _register_coach(client)

    user = db_session.query(User).filter(User.email == "coach@example.com").first()
    assert user is not None
    assert user.role == UserRole.COACH
    assert user.is_active is True

    workspace = (
        db_session.query(Organization)
        .filter(Organization.id == user.organization_id)
        .first()
    )
    assert workspace.name == "Anna Kowalska — Coaching"


def test_register_coach_duplicate_email_rejected(client, test_user):
    response = client.post(
        "/api/auth/register-coach",
        json={
            "email": test_user.email,
            "password": "password123",
            "full_name": "Dup Coach",
        },
    )
    assert response.status_code == 400


def test_register_coach_token_authenticates_as_coach(client):
    _, headers = _register_coach(client, email="c2@example.com", full_name="C Two")
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "coach"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v`
Expected: 3 FAILED with `assert 404 == 201` (endpoint does not exist yet).

- [ ] **Step 3: Add the schema**

In `backend/schemas.py`, directly after `RegisterRequest` (~line 272):

```python
class RegisterCoachRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
```

- [ ] **Step 4: Add the endpoint**

In `backend/routers/auth.py`: add `RegisterCoachRequest` to the `from schemas import ...` line, then insert after the `register` endpoint (after ~line 69):

```python
@router.post("/register-coach", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_coach(
    data: RegisterCoachRequest,
    db: Session = Depends(get_db)
):
    """
    Self-serve coach registration.

    - Creates a private workspace organization (default container for individual clients)
    - Creates the coach user inside that workspace
    - Returns JWT token
    """
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    workspace = Organization(name=f"{data.full_name} — Coaching")
    db.add(workspace)
    db.flush()  # get workspace.id

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.COACH,
        organization_id=workspace.id,
        public_token=str(uuid.uuid4()).replace("-", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v`
Expected: 3 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas.py backend/routers/auth.py backend/tests/test_coach_onboarding.py
git commit -m "feat(auth): add self-serve coach registration with private workspace org"
```

---

### Task 2: Exclude coach workspace from `/api/auth/me/organizations`

**Files:**
- Modify: `backend/routers/auth.py:137-163` (`get_my_organizations`)
- Test: `backend/tests/test_coach_onboarding.py`

**Interfaces:**
- Consumes: `_register_coach` helper from Task 1; `POST /api/organizations` (existing — auto-grants `OrganizationAccess` to a creating coach).
- Produces: for COACH role the endpoint returns ONLY client orgs (`OrganizationAccess` rows, home org excluded). Admin/manager/user behavior unchanged. Frontend Task 7 relies on this: the returned list IS the client switcher content.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_coach_onboarding.py`:

```python
def test_my_organizations_excludes_coach_workspace(client):
    _, headers = _register_coach(client, email="wcoach@example.com", full_name="W Coach")

    client.post("/api/organizations", json={"name": "Client A"}, headers=headers)
    client.post("/api/organizations", json={"name": "Client B"}, headers=headers)

    response = client.get("/api/auth/me/organizations", headers=headers)
    assert response.status_code == 200
    names = sorted(o["name"] for o in response.json())
    assert names == ["Client A", "Client B"]


def test_my_organizations_coach_with_no_clients_gets_empty_list(client):
    _, headers = _register_coach(client, email="empty@example.com", full_name="Empty Coach")
    response = client.get("/api/auth/me/organizations", headers=headers)
    assert response.json() == []


def test_my_organizations_regular_user_unchanged(client, auth_headers_user, test_organization):
    response = client.get("/api/auth/me/organizations", headers=auth_headers_user)
    assert response.json() == [
        {"id": test_organization.id, "name": test_organization.name}
    ]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v -k my_organizations`
Expected: `test_my_organizations_excludes_coach_workspace` and `..._empty_list` FAIL (workspace name present / non-empty list); `..._regular_user_unchanged` PASSES already.

- [ ] **Step 3: Rewrite the endpoint body**

In `backend/routers/auth.py` replace the body of `get_my_organizations` (lines 148-163) with:

```python
    if current_user.role.value == "admin":
        all_orgs = db.query(Organization).order_by(Organization.name).all()
        return [{"id": o.id, "name": o.name} for o in all_orgs]

    if current_user.role.value == "coach":
        # Coach: client orgs only. The home org is a private workspace and
        # must never appear in the client switcher.
        from models import OrganizationAccess
        access_list = db.query(OrganizationAccess).filter(
            OrganizationAccess.user_id == current_user.id
        ).all()
        return [
            {"id": a.organization.id, "name": a.organization.name}
            for a in access_list
            if a.organization and a.organization_id != current_user.organization_id
        ]

    return [{"id": current_user.organization.id, "name": current_user.organization.name}]
```

Also update the docstring line for Coach to: `- Coach: client organizations granted via OrganizationAccess (home workspace excluded)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v`
Expected: all PASSED.

- [ ] **Step 5: Regression check**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all PASSED (pre-existing failure `test_extract_ranked_talents_pl` in the Gallup parser is a known bug — ignore if it fails).

- [ ] **Step 6: Commit**

```bash
git add backend/routers/auth.py backend/tests/test_coach_onboarding.py
git commit -m "feat(auth): exclude coach workspace from my-organizations client list"
```

---

### Task 3: Ghost invite without a team (individual clients)

**Files:**
- Create: `backend/alembic/versions/n8o9p0q1r2s3_make_team_invitation_team_id_nullable.py`
- Modify: `backend/models.py:192` (`TeamInvitation.team_id`)
- Modify: `backend/schemas.py:167-172` (`GhostInviteCreate`)
- Modify: `backend/routers/invitations.py:95-174` (`create_ghost_invite`)
- Modify: `backend/routers/users.py` (`resend_invitation`, org fallback, ~line 686)
- Test: `backend/tests/test_coach_onboarding.py`

**Interfaces:**
- Consumes: `check_org_access(db, user, org_id)` from `backend/auth.py`; `_register_coach` helper.
- Produces: `POST /api/invitations/ghost` accepts `{email, full_name, organization_id}` (no `team_id`) → creates a team-less ghost user in that org; `team_id`-based calls unchanged; neither field → 422. Wizard (Task 8) calls this with `organization_id` for individual clients.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_coach_onboarding.py`:

```python
def _me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


def test_ghost_invite_with_organization_only(client, db_session):
    _, headers = _register_coach(client, email="gcoach@example.com", full_name="G Coach")
    me = _me(client, headers)

    response = client.post(
        "/api/invitations/ghost",
        json={
            "email": "indiv@example.com",
            "full_name": "Indiv Client",
            "organization_id": me["organization_id"],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text

    user = db_session.query(User).filter(User.email == "indiv@example.com").first()
    assert user.organization_id == me["organization_id"]
    assert user.is_ghost is True
    assert user.teams == []  # privacy invariant: no team in the workspace


def test_ghost_invite_requires_team_or_org(client):
    _, headers = _register_coach(client, email="vcoach@example.com", full_name="V Coach")
    response = client.post(
        "/api/invitations/ghost",
        json={"email": "x@example.com", "full_name": "X"},
        headers=headers,
    )
    assert response.status_code == 422


def test_ghost_invite_org_access_denied(client, db_session):
    _, headers = _register_coach(client, email="dcoach@example.com", full_name="D Coach")

    foreign_org = Organization(name="Foreign Org")
    db_session.add(foreign_org)
    db_session.commit()

    response = client.post(
        "/api/invitations/ghost",
        json={
            "email": "f@example.com",
            "full_name": "F",
            "organization_id": foreign_org.id,
        },
        headers=headers,
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v -k ghost`
Expected: FAIL — first test gets 422 (missing `team_id`), third gets 422 instead of 403.

- [ ] **Step 3: Alembic migration + model change**

Create `backend/alembic/versions/n8o9p0q1r2s3_make_team_invitation_team_id_nullable.py`:

```python
"""Make team_invitations.team_id nullable for individual-client invitations.

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
"""
from alembic import op
import sqlalchemy as sa

revision = "n8o9p0q1r2s3"
down_revision = "m7n8o9p0q1r2"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "team_invitations", "team_id",
        existing_type=sa.Integer(), nullable=True,
    )


def downgrade():
    op.alter_column(
        "team_invitations", "team_id",
        existing_type=sa.Integer(), nullable=False,
    )
```

In `backend/models.py:192` change:

```python
    team_id = Column(Integer, ForeignKey('teams.id', ondelete='CASCADE'), nullable=True)
```

- [ ] **Step 4: Schema change**

In `backend/schemas.py` add `model_validator` to the pydantic import at the top of the file (e.g. `from pydantic import BaseModel, EmailStr, Field, model_validator`), then replace `GhostInviteCreate` (lines 167-172):

```python
class GhostInviteCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    job_title: Optional[str] = None
    team_id: Optional[int] = None
    organization_id: Optional[int] = None
    talents: Optional[List[GhostInviteTalent]] = None

    @model_validator(mode="after")
    def require_team_or_organization(self):
        if self.team_id is None and self.organization_id is None:
            raise ValueError("Either team_id or organization_id is required")
        return self
```

- [ ] **Step 5: Router change**

In `backend/routers/invitations.py`: add `Organization` to the `from models import (...)` block. Replace the beginning of `create_ghost_invite` (lines 101-118) with:

```python
    team = None
    if data.team_id is not None:
        team = db.query(Team).filter(Team.id == data.team_id).first()
        if not team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found",
            )
        target_org_id = team.organization_id
    else:
        target_org_id = data.organization_id
        if not db.query(Organization).filter(Organization.id == target_org_id).first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found",
            )

    if not check_org_access(db, current_user, target_org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization",
        )

    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user and existing_user.organization_id != target_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User belongs to a different organization",
        )
```

Then adjust the rest of the function:
- User creation (line 132): `organization_id=target_org_id,` (instead of `team.organization_id`).
- Team membership (lines 137-138): wrap in `if team is not None:` → `if team is not None and user not in team.members: team.members.append(user)`.
- Revoke query (lines 144-153): replace the `TeamInvitation.team_id == team.id` filter with a branch:

```python
    revoke_q = db.query(TeamInvitation).filter(
        TeamInvitation.user_id == user.id,
        TeamInvitation.status == InvitationStatus.ACTIVE,
    )
    if team is not None:
        revoke_q = revoke_q.filter(TeamInvitation.team_id == team.id)
    else:
        revoke_q = revoke_q.filter(TeamInvitation.team_id.is_(None))
    revoke_q.update(
        {
            TeamInvitation.status: InvitationStatus.REVOKED,
            TeamInvitation.revoked_at: datetime.now(timezone.utc),
        }
    )
```

- Invitation creation (line 158): `team_id=team.id if team is not None else None,`.

- [ ] **Step 6: Resend fallback for team-less invitations**

In `backend/routers/users.py`, in `resend_invitation` (~line 686), change:

```python
    team = db.query(Team).filter(Team.id == invitation.team_id).first() if invitation.team_id else None
    org = team.organization if team else ghost.organization
```

(the subsequent `org_name=org.name if org else ""` now resolves from the ghost's own organization for individual clients).

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py tests/test_invitations.py -v`
Expected: all PASSED (including pre-existing invitation tests — the `team_id` path is regression-covered there).

- [ ] **Step 8: Commit**

```bash
git add backend/alembic/versions/n8o9p0q1r2s3_make_team_invitation_team_id_nullable.py backend/models.py backend/schemas.py backend/routers/invitations.py backend/routers/users.py backend/tests/test_coach_onboarding.py
git commit -m "feat(invitations): support team-less ghost invites for individual coach clients"
```

---

### Task 4: `POST /api/users/{id}/move-organization` — pin individual client to an org

**Files:**
- Modify: `backend/schemas.py` (after `GhostInviteCreate` section)
- Modify: `backend/routers/users.py` (new endpoint after `resend_invitation`)
- Test: `backend/tests/test_coach_onboarding.py`

**Interfaces:**
- Consumes: `check_org_access`, `require_role`, `TeamCreate.organization_id` (teams can be created for any accessible org by passing `organization_id` in the body).
- Produces: `POST /api/users/{user_id}/move-organization` with body `{organization_id: int, team_id?: int}` → `200 {"ok": true}`. Moves the user, clears team memberships, revokes team-bound active invitations (team-less ones survive). Frontend Task 5 exposes it as `api.users.moveOrganization(userId, data)`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_coach_onboarding.py`:

```python
def _create_individual(client, headers, org_id, email="pin@example.com"):
    r = client.post(
        "/api/invitations/ghost",
        json={"email": email, "full_name": "Pin Me", "organization_id": org_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["user_id"]


def test_move_individual_to_client_org_with_team(client, db_session):
    _, headers = _register_coach(client, email="mcoach@example.com", full_name="M Coach")
    me = _me(client, headers)
    user_id = _create_individual(client, headers, me["organization_id"])

    org = client.post("/api/organizations", json={"name": "Client X"}, headers=headers).json()
    team = client.post(
        "/api/teams",
        json={"name": "Team X", "organization_id": org["id"]},
        headers=headers,
    ).json()

    response = client.post(
        f"/api/users/{user_id}/move-organization",
        json={"organization_id": org["id"], "team_id": team["id"]},
        headers=headers,
    )
    assert response.status_code == 200, response.text

    moved = db_session.query(User).filter(User.id == user_id).first()
    db_session.refresh(moved)
    assert moved.organization_id == org["id"]
    assert [t.id for t in moved.teams] == [team["id"]]


def test_move_denied_without_target_access(client, db_session, test_organization):
    _, headers = _register_coach(client, email="ncoach@example.com", full_name="N Coach")
    me = _me(client, headers)
    user_id = _create_individual(client, headers, me["organization_id"], email="pin2@example.com")

    # test_organization belongs to nobody the coach knows — no OrganizationAccess
    response = client.post(
        f"/api/users/{user_id}/move-organization",
        json={"organization_id": test_organization.id},
        headers=headers,
    )
    assert response.status_code == 403


def test_move_rejects_non_user_roles(client, db_session, test_admin):
    _, headers = _register_coach(client, email="rcoach@example.com", full_name="R Coach")
    response = client.post(
        f"/api/users/{test_admin.id}/move-organization",
        json={"organization_id": test_admin.organization_id},
        headers=headers,
    )
    assert response.status_code in (400, 403)  # role guard or access guard — both acceptable


def test_move_team_must_belong_to_target_org(client, db_session):
    _, headers = _register_coach(client, email="tcoach@example.com", full_name="T Coach")
    me = _me(client, headers)
    user_id = _create_individual(client, headers, me["organization_id"], email="pin3@example.com")

    org_a = client.post("/api/organizations", json={"name": "Org A"}, headers=headers).json()
    org_b = client.post("/api/organizations", json={"name": "Org B"}, headers=headers).json()
    team_b = client.post(
        "/api/teams",
        json={"name": "Team B", "organization_id": org_b["id"]},
        headers=headers,
    ).json()

    response = client.post(
        f"/api/users/{user_id}/move-organization",
        json={"organization_id": org_a["id"], "team_id": team_b["id"]},
        headers=headers,
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v -k move`
Expected: FAIL with 404 (endpoint does not exist).

- [ ] **Step 3: Add the schema**

In `backend/schemas.py`, after the `GhostInviteResponse` class:

```python
class MoveOrganizationRequest(BaseModel):
    organization_id: int
    team_id: Optional[int] = None
```

- [ ] **Step 4: Add the endpoint**

In `backend/routers/users.py`, add `MoveOrganizationRequest` to the `from schemas import ...` block, then insert after `resend_invitation`:

```python
@router.post("/{user_id}/move-organization", status_code=status.HTTP_200_OK)
def move_user_organization(
    user_id: int,
    payload: MoveOrganizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "coach"])),
):
    """Move a user to another organization (pin an individual client to a client org).

    Caller must have access to BOTH the user's current organization and the target.
    Team memberships are cleared (they reference the old org); team-bound active
    invitations are revoked, team-less ones stay valid.
    """
    from datetime import datetime, timezone
    from models import Team, TeamInvitation, InvitationStatus, Organization

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only regular users can be moved between organizations",
        )
    if not check_org_access(db, current_user, user.organization_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to user's organization")
    if not check_org_access(db, current_user, payload.organization_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to target organization")
    if not db.query(Organization).filter(Organization.id == payload.organization_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target organization not found")

    team = None
    if payload.team_id is not None:
        team = db.query(Team).filter(Team.id == payload.team_id).first()
        if not team or team.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team does not belong to the target organization",
            )

    user.teams.clear()
    db.query(TeamInvitation).filter(
        TeamInvitation.user_id == user.id,
        TeamInvitation.status == InvitationStatus.ACTIVE,
        TeamInvitation.team_id.isnot(None),
    ).update(
        {
            TeamInvitation.status: InvitationStatus.REVOKED,
            TeamInvitation.revoked_at: datetime.now(timezone.utc),
        },
        synchronize_session=False,
    )
    user.organization_id = payload.organization_id
    if team is not None:
        team.members.append(user)
    db.commit()
    return {"ok": True}
```

Note: `users.py` already imports `UserRole`, `check_org_access`, `require_role` — verify at the top of the file and add any that are missing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_coach_onboarding.py -v`
Expected: all PASSED.

- [ ] **Step 6: Full backend regression + commit**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all PASSED (modulo the known `test_extract_ranked_talents_pl` parser bug).

```bash
git add backend/schemas.py backend/routers/users.py backend/tests/test_coach_onboarding.py
git commit -m "feat(users): add move-organization endpoint for pinning individual clients"
```

---

### Task 5: Frontend API client additions

**Files:**
- Modify: `frontend/lib/api.ts`

**Interfaces:**
- Consumes: backend endpoints from Tasks 1-4.
- Produces (used by Tasks 6, 8, 9):
  - `api.auth.registerCoach(data: {email, password, full_name}): Promise<AuthResponse>`
  - `api.users.moveOrganization(userId: number, data: {organization_id: number, team_id?: number}): Promise<{ok: boolean}>`
  - `api.users.list(teamId?: number, orgIdOverride?: number)` — per-request org override
  - `api.teams.list(orgIdOverride?: number)` — per-request org override
  - `GhostInviteData` type with `team_id?: number; organization_id?: number`

- [ ] **Step 1: Make the interceptor respect per-request org headers**

In `frontend/lib/api.ts:354-357`, change the request interceptor so an explicitly set header wins:

```typescript
        const activeOrgId = tokenManager.getActiveOrgId();
        if (activeOrgId && config.headers && !config.headers['X-Organization-Id']) {
            config.headers['X-Organization-Id'] = activeOrgId.toString();
        }
```

- [ ] **Step 2: Add `registerCoach`**

In the `auth` section (after `register`, ~line 416):

```typescript
        registerCoach: async (data: { email: string; password: string; full_name: string }): Promise<AuthResponse> => {
            const response = await apiClient.post<AuthResponse>('/api/auth/register-coach', data);
            return response.data;
        },
```

- [ ] **Step 3: Org override on `users.list` and `teams.list`**

Replace `users.list` (~line 522):

```typescript
        list: async (teamId?: number, orgIdOverride?: number) => {
            const params = teamId ? { team_id: teamId } : {};
            const headers = orgIdOverride ? { 'X-Organization-Id': String(orgIdOverride) } : undefined;
            const response = await apiClient.get('/api/users', { params, headers });
            return response.data;
        },
```

Replace `teams.list` (~line 468):

```typescript
        list: async (orgIdOverride?: number): Promise<Team[]> => {
            const headers = orgIdOverride ? { 'X-Organization-Id': String(orgIdOverride) } : undefined;
            const response = await apiClient.get<Team[]>('/api/teams', { headers });
            return response.data;
        },
```

- [ ] **Step 4: Add `moveOrganization`**

In the `users` section (after `resendInvitation`, ~line 620):

```typescript
        moveOrganization: async (userId: number, data: { organization_id: number; team_id?: number }): Promise<{ ok: boolean }> => {
            const response = await apiClient.post<{ ok: boolean }>(`/api/users/${userId}/move-organization`, data);
            return response.data;
        },
```

- [ ] **Step 5: Ghost invite type**

Find the ghost-invite payload type (grep `GhostInvite` in `frontend/lib/api.ts`); make `team_id` optional and add `organization_id?: number`:

```typescript
    team_id?: number;
    organization_id?: number;
```

- [ ] **Step 6: Verify build + commit**

Run: `cd frontend && npm run build`
Expected: build succeeds, no type errors.

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): api client for coach registration, move-organization, org overrides"
```

---

### Task 6: `/register/coach` signup page

**Files:**
- Create: `frontend/app/(auth)/register/coach/page.tsx`
- Modify: `frontend/app/(auth)/register/page.tsx` (footer link)
- Modify: `frontend/messages/pl.json`, `frontend/messages/en.json` (`auth.registerCoach.*`)

**Interfaces:**
- Consumes: `api.auth.registerCoach` (Task 5), `tokenManager`.
- Produces: route `/register/coach`; on success sets cookie `onboarding=1` and redirects to `/dashboard/onboarding` (the coach wizard from Task 8 lands there).

- [ ] **Step 1: Add i18n keys**

In `frontend/messages/pl.json` under `auth`, add:

```json
"registerCoach": {
    "title": "Konto coacha",
    "subtitle": "Pracuj ze swoimi klientami w oparciu o talenty Gallupa",
    "fullName": "Imię i nazwisko",
    "email": "Email",
    "password": "Hasło",
    "submit": "Załóż konto coacha",
    "submitting": "Tworzenie konta...",
    "haveAccount": "Masz już konto?",
    "login": "Zaloguj się",
    "memberHint": "Jesteś członkiem zespołu? Poproś swojego coacha lub lidera o zaproszenie."
}
```

In `frontend/messages/en.json` under `auth`, add:

```json
"registerCoach": {
    "title": "Coach account",
    "subtitle": "Work with your clients using Gallup talents",
    "fullName": "Full name",
    "email": "Email",
    "password": "Password",
    "submit": "Create coach account",
    "submitting": "Creating account...",
    "haveAccount": "Already have an account?",
    "login": "Log in",
    "memberHint": "Are you a team member? Ask your coach or leader for an invitation."
}
```

- [ ] **Step 2: Create the page**

Create `frontend/app/(auth)/register/coach/page.tsx` (styling mirrors `register/page.tsx` — check that file for the exact input/button classes and reuse them):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, tokenManager } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

export default function RegisterCoachPage() {
    const t = useTranslations("auth.registerCoach");
    const router = useRouter();
    const [formData, setFormData] = useState({ full_name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { access_token } = await api.auth.registerCoach(formData);
            tokenManager.setToken(access_token);
            const user = await api.auth.getCurrentUser();
            tokenManager.setUser(user);
            // One-time cookie routes the coach into the onboarding wizard
            document.cookie = "onboarding=1; path=/; max-age=3600; SameSite=Lax";
            router.push("/dashboard/onboarding");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold font-heading text-primary tracking-tight">TalentPilot</h1>
                    <p className="text-slate-500 mt-2 font-medium">{t("subtitle")}</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">{t("title")}</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="full_name" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("fullName")}
                            </label>
                            <input
                                id="full_name" name="full_name" type="text" required
                                value={formData.full_name} onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("email")}
                            </label>
                            <input
                                id="email" name="email" type="email" required
                                value={formData.email} onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 ml-1">
                                {t("password")}
                            </label>
                            <input
                                id="password" name="password" type="password" required minLength={8}
                                value={formData.password} onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                            />
                        </div>
                        {error && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                                {error}
                            </div>
                        )}
                        <button
                            type="submit" disabled={loading}
                            className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
                        >
                            {loading ? t("submitting") : t("submit")}
                        </button>
                    </form>
                    <p className="mt-6 text-center text-sm text-slate-500">
                        {t("haveAccount")}{" "}
                        <Link href="/login" className="font-semibold text-primary hover:underline">{t("login")}</Link>
                    </p>
                    <p className="mt-3 text-center text-xs text-slate-400">{t("memberHint")}</p>
                </div>
            </div>
        </div>
    );
}
```

Before committing, open `frontend/app/(auth)/register/page.tsx` and align input/button/container class names with what that page actually uses (keep the two pages visually identical). Verify `getErrorMessage` is exported from `@/lib/utils` (the register page imports it — copy its import path).

- [ ] **Step 3: Cross-link from the standard register page**

In `frontend/app/(auth)/register/page.tsx`, below the existing form/footer links, add (with i18n keys `auth.register.coachCta` = PL `"Jesteś coachem?"` / EN `"Are you a coach?"`, `auth.register.coachLink` = PL `"Załóż konto coacha"` / EN `"Create a coach account"`):

```tsx
<p className="mt-3 text-center text-sm text-slate-500">
    {t("coachCta")}{" "}
    <Link href="/register/coach" className="font-semibold text-primary hover:underline">
        {t("coachLink")}
    </Link>
</p>
```

- [ ] **Step 4: Verify + commit**

Run: `cd frontend && npm run build && npm run lint`
Expected: build and lint pass.

Manual smoke (optional but recommended): `npm run dev`, open `http://localhost:3000/register/coach`, register a coach against the local backend, confirm redirect to `/dashboard/onboarding`.

```bash
git add "frontend/app/(auth)/register/coach/page.tsx" "frontend/app/(auth)/register/page.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): dedicated coach signup page at /register/coach"
```

---

### Task 7: Role-scoped sidebar, client switcher, page guards

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/my-talents/page.tsx` (coach guard)
- Modify: `frontend/app/(dashboard)/dashboard/tips/page.tsx` (hide Daily section for coach)
- Modify: `frontend/messages/pl.json`, `frontend/messages/en.json` (`nav.clients`, `nav.myWorkspace`)

**Interfaces:**
- Consumes: `api.auth.getMyOrganizations()` now returns ONLY client orgs for coaches (Task 2).
- Produces: coach sees no "Moje Talenty" / Daily-Tip UI; org switcher labeled as client picker, visible for coach with ≥1 client; `nav.clients` label reused by Task 9.

- [ ] **Step 1: i18n keys**

`frontend/messages/pl.json` → `nav`: add `"clients": "Klienci"`, `"myWorkspace": "Mój workspace"`.
`frontend/messages/en.json` → `nav`: add `"clients": "Clients"`, `"myWorkspace": "My workspace"`.
`frontend/messages/pl.json` → `qa`: add `"subtitleCoach": "Zapytaj o talenty osób i zespołów, z którymi pracujesz"`.
`frontend/messages/en.json` → `qa`: add `"subtitleCoach": "Ask about the talents of the people and teams you work with"`.

- [ ] **Step 2: Sidebar branching in `layout.tsx`**

After `const [user, setUser] = ...` usage is available (inside the component body, after the loading guard), derive:

```tsx
    const isCoach = user?.role === 'coach';
```

Replace the `navigation` array (lines 122-129):

```tsx
    const navigation = [
        { name: t("overview"), href: "/dashboard", icon: LayoutDashboard },
        // Self-as-member features are hidden for coaches — they work on clients, not on themselves
        ...(!isCoach ? [{ name: t("myTalents"), href: "/dashboard/my-talents", icon: Sparkles }] : []),
        { name: t("qa"), href: "/dashboard/qa", icon: MessageSquare },
        { name: t("teams"), href: "/dashboard/teams", icon: Users },
        { name: t("compare"), href: "/dashboard/compare", icon: GitCompare },
        { name: t("tips"), href: "/dashboard/tips", icon: Zap },
    ];
```

In `adminNavigation` (line 138) the Organizations entry gets a coach-aware label:

```tsx
        { name: isCoach ? t("clients") : t("organizations"), href: "/dashboard/organizations", icon: Building },
```

- [ ] **Step 3: Client switcher for coach**

In the header (line 312), change the visibility condition so a coach with a single client can still switch between the client and their workspace context:

```tsx
                        {(organizations.length > 1 || (isCoach && organizations.length >= 1)) && (
```

In the switcher button label (line 320), fall back to the workspace label when the active org is not on the client list:

```tsx
                                        {organizations.find(o => o.id === activeOrgId)?.name || (isCoach ? t('myWorkspace') : t('orgFallback'))}
```

- [ ] **Step 4: Guard `/dashboard/my-talents`**

In `frontend/app/(dashboard)/dashboard/my-talents/page.tsx`, at the top of the component add (adapt to the file's existing imports — it already uses `useRouter` or add it):

```tsx
    const router = useRouter();
    useEffect(() => {
        if (tokenManager.getUser()?.role === 'coach') {
            router.replace('/dashboard');
        }
    }, [router]);
```

Import `tokenManager` from `@/lib/api` if not already imported.

- [ ] **Step 5: Hide the Daily Tip section for coach in tips page**

In `frontend/app/(dashboard)/dashboard/tips/page.tsx`, derive `const isCoach = tokenManager.getUser()?.role === 'coach';` near the other hooks (import `tokenManager` if missing), then wrap SECTION 1 (lines 237-313, the block commented `─── SECTION 1: DAILY TIP ───`) in:

```tsx
            {!isCoach && (
                <div className="space-y-4">
                    {/* ...existing SECTION 1 content unchanged... */}
                </div>
            )}
```

(The Synergy/Mosty section stays for everyone — it is a coach session-prep tool.)

- [ ] **Step 6: Reframe Q&A subtitle for coach**

In `frontend/app/(dashboard)/dashboard/qa/page.tsx`, derive `const isCoach = tokenManager.getUser()?.role === 'coach';` (import `tokenManager` if missing) and render the page subtitle conditionally:

```tsx
{isCoach ? t("subtitleCoach") : t("subtitle")}
```

(find the existing `t("subtitle")` usage in the page header and replace it with the conditional — this is UI reframing only, the Q&A engine is untouched).

- [ ] **Step 7: Verify + commit**

Run: `cd frontend && npm run build && npm run lint`
Expected: pass.

Manual smoke: log in as the coach from Task 6 → sidebar shows no "Moje Talenty"; `/dashboard/my-talents` bounces to `/dashboard`; tips page shows only Mosty; sidebar admin section shows "Klienci".

```bash
git add "frontend/app/(dashboard)/layout.tsx" "frontend/app/(dashboard)/dashboard/my-talents/page.tsx" "frontend/app/(dashboard)/dashboard/tips/page.tsx" "frontend/app/(dashboard)/dashboard/qa/page.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): role-scoped sidebar and guards for coach role"
```

---

### Task 8: Coach onboarding wizard

**Files:**
- Create: `frontend/components/onboarding/CoachWizard.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/onboarding/page.tsx` (role branch)
- Modify: `frontend/app/(dashboard)/dashboard/page.tsx` (resume banner for coach)
- Modify: `frontend/messages/pl.json`, `frontend/messages/en.json` (`onboarding.coach.*`)

**Interfaces:**
- Consumes: `api.auth.getMyOrganizations`, `api.users.list(teamId?, orgIdOverride?)`, `api.organizations.create`, `api.teams.create` (body supports `organization_id`), `api.invitations.ghost` (`{organization_id}` or `{team_id}`), `api.gallup.parsePdf(file)` → `{rankings: Record<string, number>, language, ...}`, `api.gallup.saveTalents(userId, rankings)`, `api.users.resendInvitation(userId)`.
- Produces: coach-facing wizard at `/dashboard/onboarding`; members keep the existing screen untouched.

- [ ] **Step 1: i18n keys**

Add to `frontend/messages/pl.json` under `onboarding`:

```json
"coach": {
    "title": "Witaj w TalentPilot, {name}!",
    "subtitle": "Skonfiguruj swój warsztat pracy w kilku krokach",
    "skip": "Pomiń — przejdź do aplikacji",
    "stepClientType": "Kogo chcesz dodać jako pierwszego klienta?",
    "clientPerson": "Osoba",
    "clientPersonDesc": "Klient indywidualny — profil talentów i praca 1:1",
    "clientOrg": "Organizacja",
    "clientOrgDesc": "Zespół klienta — matryca talentów i praca grupowa",
    "personFullName": "Imię i nazwisko",
    "personEmail": "Email",
    "talentSource": "Skąd wziąć talenty?",
    "talentPdf": "Wgram raport Gallup PDF teraz",
    "talentInvite": "Wyślij zaproszenie — klient wgra sam",
    "talentNone": "Na razie bez talentów",
    "pdfFile": "Raport Gallup (PDF)",
    "addPerson": "Dodaj osobę",
    "adding": "Dodawanie...",
    "orgName": "Nazwa organizacji klienta",
    "createOrg": "Utwórz klienta",
    "teamName": "Nazwa zespołu",
    "createTeam": "Utwórz zespół",
    "peopleTitle": "Dodaj osoby do zespołu",
    "peopleAdded": "Dodane osoby",
    "finishToMatrix": "Zakończ — otwórz matrycę zespołu",
    "finishToProfile": "Zakończ — otwórz profil klienta",
    "addAnother": "Dodaj kolejną osobę",
    "resumeBanner": "Dokończ konfigurację konta coacha",
    "resumeCta": "Kontynuuj",
    "error": "Coś poszło nie tak. Spróbuj ponownie."
}
```

Add the English equivalents to `frontend/messages/en.json` under `onboarding`:

```json
"coach": {
    "title": "Welcome to TalentPilot, {name}!",
    "subtitle": "Set up your coaching workspace in a few steps",
    "skip": "Skip — go to the app",
    "stepClientType": "Who do you want to add as your first client?",
    "clientPerson": "Person",
    "clientPersonDesc": "Individual client — talent profile and 1:1 work",
    "clientOrg": "Organization",
    "clientOrgDesc": "Client team — talent matrix and group work",
    "personFullName": "Full name",
    "personEmail": "Email",
    "talentSource": "Where do the talents come from?",
    "talentPdf": "I'll upload the Gallup PDF now",
    "talentInvite": "Send an invitation — the client uploads it",
    "talentNone": "No talents for now",
    "pdfFile": "Gallup report (PDF)",
    "addPerson": "Add person",
    "adding": "Adding...",
    "orgName": "Client organization name",
    "createOrg": "Create client",
    "teamName": "Team name",
    "createTeam": "Create team",
    "peopleTitle": "Add people to the team",
    "peopleAdded": "People added",
    "finishToMatrix": "Finish — open the team matrix",
    "finishToProfile": "Finish — open the client profile",
    "addAnother": "Add another person",
    "resumeBanner": "Finish setting up your coach account",
    "resumeCta": "Continue",
    "error": "Something went wrong. Please try again."
}
```

- [ ] **Step 2: Create `CoachWizard.tsx`**

Create `frontend/components/onboarding/CoachWizard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { User as UserIcon, Building, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Step = "loading" | "clientType" | "person" | "org" | "team" | "people" | "done";
type TalentSource = "pdf" | "invite" | "none";

interface AddedPerson {
    userId: number;
    fullName: string;
}

export default function CoachWizard() {
    const t = useTranslations("onboarding.coach");
    const router = useRouter();
    const me = tokenManager.getUser();

    const [step, setStep] = useState<Step>("loading");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    // Org path context
    const [clientOrgId, setClientOrgId] = useState<number | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [addedPeople, setAddedPeople] = useState<AddedPerson[]>([]);
    // Individual path result
    const [personUserId, setPersonUserId] = useState<number | null>(null);

    // Forms
    const [orgName, setOrgName] = useState("");
    const [teamName, setTeamName] = useState("");
    const [personName, setPersonName] = useState("");
    const [personEmail, setPersonEmail] = useState("");
    const [talentSource, setTalentSource] = useState<TalentSource>("pdf");
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    // Resume: derive the current step from existing data
    useEffect(() => {
        if (!me) return;
        (async () => {
            try {
                const clients = await api.auth.getMyOrganizations();
                if (clients.length === 0) {
                    const individuals = (await api.users.list(undefined, me.organization_id))
                        .filter((u: { id: number }) => u.id !== me.id);
                    if (individuals.length > 0) {
                        router.replace("/dashboard");
                        return;
                    }
                    setStep("clientType");
                    return;
                }
                // Org path in progress: resume on the first client
                const firstClient = clients[0];
                setClientOrgId(firstClient.id);
                tokenManager.setActiveOrgId(firstClient.id);
                const teams = await api.teams.list(firstClient.id);
                if (teams.length === 0) {
                    setStep("team");
                    return;
                }
                setTeamId(teams[0].id);
                const members = await api.users.list(teams[0].id, firstClient.id);
                if (members.length === 0) {
                    setStep("people");
                    return;
                }
                router.replace("/dashboard");
            } catch {
                setStep("clientType");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSkip = () => {
        document.cookie = "onboarding=; path=/; max-age=0";
        router.push("/dashboard");
    };

    const submitPerson = async (targetTeamId: number | null) => {
        if (!me) return;
        setBusy(true);
        setError("");
        try {
            const payload = targetTeamId
                ? { email: personEmail, full_name: personName, team_id: targetTeamId }
                : { email: personEmail, full_name: personName, organization_id: me.organization_id };
            const ghost = await api.invitations.ghost(payload);

            if (talentSource === "pdf" && pdfFile) {
                const parsed = await api.gallup.parsePdf(pdfFile);
                await api.gallup.saveTalents(ghost.user_id, parsed.rankings);
            } else if (talentSource === "invite") {
                await api.users.resendInvitation(ghost.user_id);
            }

            if (targetTeamId) {
                setAddedPeople((prev) => [...prev, { userId: ghost.user_id, fullName: personName }]);
            } else {
                setPersonUserId(ghost.user_id);
                setStep("done");
            }
            setPersonName("");
            setPersonEmail("");
            setPdfFile(null);
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const submitOrg = async () => {
        setBusy(true);
        setError("");
        try {
            const org = await api.organizations.create({ name: orgName });
            setClientOrgId(org.id);
            tokenManager.setActiveOrgId(org.id);
            setStep("team");
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const submitTeam = async () => {
        if (!clientOrgId) return;
        setBusy(true);
        setError("");
        try {
            const team = await api.teams.create({ name: teamName, organization_id: clientOrgId });
            setTeamId(team.id);
            setStep("people");
        } catch {
            setError(t("error"));
        } finally {
            setBusy(false);
        }
    };

    const handleFinish = () => {
        document.cookie = "onboarding=; path=/; max-age=0";
        if (teamId) {
            router.push(`/dashboard/teams/${teamId}`);
        } else if (personUserId) {
            router.push(`/dashboard/users/${personUserId}`);
        } else {
            router.push("/dashboard");
        }
    };

    if (step === "loading") {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    const personForm = (targetTeamId: number | null) => (
        <div className="space-y-4">
            <input
                type="text" required placeholder={t("personFullName")}
                value={personName} onChange={(e) => setPersonName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <input
                type="email" required placeholder={t("personEmail")}
                value={personEmail} onChange={(e) => setPersonEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">{t("talentSource")}</p>
                {(["pdf", "invite", "none"] as TalentSource[]).map((src) => (
                    <label key={src} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="radio" name="talentSource" checked={talentSource === src}
                            onChange={() => setTalentSource(src)}
                        />
                        {src === "pdf" ? t("talentPdf") : src === "invite" ? t("talentInvite") : t("talentNone")}
                    </label>
                ))}
            </div>
            {talentSource === "pdf" && (
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-700">{t("pdfFile")}</p>
                    <input
                        type="file" accept="application/pdf"
                        onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500"
                    />
                </div>
            )}
            <Button
                onClick={() => submitPerson(targetTeamId)}
                disabled={busy || !personName || !personEmail || (talentSource === "pdf" && !pdfFile)}
            >
                {busy ? t("adding") : t("addPerson")}
            </Button>
        </div>
    );

    return (
        <div className="flex min-h-screen items-start justify-center px-6 py-12 bg-slate-50">
            <div className="w-full max-w-xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {t("title", { name: me?.full_name || "" })}
                    </h1>
                    <p className="text-slate-500">{t("subtitle")}</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
                    {step === "clientType" && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("stepClientType")}</h2>
                            <button
                                onClick={() => setStep("person")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 hover:border-primary text-left transition"
                            >
                                <UserIcon className="w-8 h-8 text-purple-600 shrink-0" />
                                <div>
                                    <div className="font-semibold text-slate-800">{t("clientPerson")}</div>
                                    <div className="text-sm text-slate-500">{t("clientPersonDesc")}</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setStep("org")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border border-slate-200 hover:border-primary text-left transition"
                            >
                                <Building className="w-8 h-8 text-blue-600 shrink-0" />
                                <div>
                                    <div className="font-semibold text-slate-800">{t("clientOrg")}</div>
                                    <div className="text-sm text-slate-500">{t("clientOrgDesc")}</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === "person" && personForm(null)}

                    {step === "org" && (
                        <div className="space-y-4">
                            <input
                                type="text" required placeholder={t("orgName")}
                                value={orgName} onChange={(e) => setOrgName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <Button onClick={submitOrg} disabled={busy || !orgName}>
                                {busy ? t("adding") : t("createOrg")}
                            </Button>
                        </div>
                    )}

                    {step === "team" && (
                        <div className="space-y-4">
                            <input
                                type="text" required placeholder={t("teamName")}
                                value={teamName} onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <Button onClick={submitTeam} disabled={busy || !teamName}>
                                {busy ? t("adding") : t("createTeam")}
                            </Button>
                        </div>
                    )}

                    {step === "people" && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800">{t("peopleTitle")}</h2>
                            {addedPeople.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-slate-700">{t("peopleAdded")}</p>
                                    {addedPeople.map((p) => (
                                        <div key={p.userId} className="flex items-center gap-2 text-sm text-slate-600">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {p.fullName}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {personForm(teamId)}
                            {addedPeople.length > 0 && (
                                <Button variant="outline" onClick={handleFinish} className="w-full">
                                    {t("finishToMatrix")} <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    )}

                    {step === "done" && (
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                            <Button onClick={handleFinish}>
                                {t("finishToProfile")} <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {error}
                        </div>
                    )}
                </div>

                <div className="text-center mt-6">
                    <button onClick={handleSkip} className="text-sm text-slate-400 hover:text-slate-600 underline">
                        {t("skip")}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

Adapt to reality while implementing: check the actual return shapes of `api.invitations.ghost` (`user_id` field), `api.teams.create` (`id` field), `api.organizations.create` (`id` field) in `frontend/lib/api.ts` and fix property access if they differ. Check that `User` type from `lib/api` exposes `organization_id` (it does — the layout uses it).

- [ ] **Step 3: Branch the onboarding page by role**

In `frontend/app/(dashboard)/dashboard/onboarding/page.tsx`, add the import and an early branch at the top of the component (before the member cookie-guard `useEffect` — move the member logic into a separate inner component so hooks don't run conditionally):

```tsx
import CoachWizard from "@/components/onboarding/CoachWizard";
// ...
export default function OnboardingPage() {
    const isCoach = typeof window !== "undefined" && tokenManager.getUser()?.role === "coach";
    if (isCoach) return <CoachWizard />;
    return <MemberOnboarding />;
}

function MemberOnboarding() {
    // ...entire existing component body moves here unchanged (cookie guard included)...
}
```

- [ ] **Step 4: Resume banner on the dashboard**

In `frontend/app/(dashboard)/dashboard/page.tsx`, add state + effect (coach only): fetch `api.auth.getMyOrganizations()`; if the list is empty AND `api.users.list(undefined, me.organization_id)` has no one besides the coach, render a banner above the KPI grid:

```tsx
{showCoachOnboardingBanner && (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4">
        <p className="text-sm font-medium text-blue-800">{tOnboarding("coach.resumeBanner")}</p>
        <Link href="/dashboard/onboarding" className="text-sm font-bold text-blue-700 hover:underline">
            {tOnboarding("coach.resumeCta")} →
        </Link>
    </div>
)}
```

where `const tOnboarding = useTranslations("onboarding");` and `showCoachOnboardingBanner` is the boolean computed in the effect (default `false`, never true for non-coach roles).

- [ ] **Step 5: Verify + commit**

Run: `cd frontend && npm run build && npm run lint`
Expected: pass.

Manual smoke (recommended — full loop): register a fresh coach → wizard appears → path A: add a person with a Gallup PDF → lands on profile with talents; path B (second fresh coach): org → team → 2 people → matrix. Reload mid-wizard → resumes at the correct step. Skip → dashboard shows the resume banner.

```bash
git add frontend/components/onboarding/CoachWizard.tsx "frontend/app/(dashboard)/dashboard/onboarding/page.tsx" "frontend/app/(dashboard)/dashboard/page.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): coach onboarding wizard with individual and org client paths"
```

---

### Task 9: "Klienci" view — Individuals tab with pin-to-organization

**Files:**
- Create: `frontend/components/clients/IndividualClientsTab.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/organizations/page.tsx` (tabs for coach)
- Modify: `frontend/messages/pl.json`, `frontend/messages/en.json` (`clients.*` namespace)

**Interfaces:**
- Consumes: `api.users.list(undefined, workspaceOrgId)`, `api.auth.getMyOrganizations`, `api.organizations.create`, `api.teams.list(orgIdOverride)`, `api.users.moveOrganization` (Task 5).
- Produces: coach-only tab UI on the organizations page; the pin action moves an individual into a client org.

- [ ] **Step 1: i18n keys**

Add a top-level `clients` namespace to `frontend/messages/pl.json`:

```json
"clients": {
    "tabOrgs": "Organizacje",
    "tabIndividuals": "Indywidualni",
    "empty": "Brak klientów indywidualnych. Dodaj ich w kreatorze lub zaproś bezpośrednio.",
    "pin": "Przypnij do organizacji",
    "pinTitle": "Przypnij {name} do organizacji",
    "pinExisting": "Wybierz organizację",
    "pinNew": "Lub utwórz nową",
    "pinNewName": "Nazwa nowej organizacji",
    "pinTeam": "Zespół (opcjonalnie)",
    "pinNoTeam": "Bez zespołu",
    "pinConfirm": "Przypnij",
    "pinning": "Przypinanie...",
    "cancel": "Anuluj",
    "error": "Nie udało się przypiąć klienta. Spróbuj ponownie."
}
```

And to `frontend/messages/en.json`:

```json
"clients": {
    "tabOrgs": "Organizations",
    "tabIndividuals": "Individuals",
    "empty": "No individual clients yet. Add them in the wizard or invite directly.",
    "pin": "Pin to organization",
    "pinTitle": "Pin {name} to an organization",
    "pinExisting": "Choose an organization",
    "pinNew": "Or create a new one",
    "pinNewName": "New organization name",
    "pinTeam": "Team (optional)",
    "pinNoTeam": "No team",
    "pinConfirm": "Pin",
    "pinning": "Pinning...",
    "cancel": "Cancel",
    "error": "Failed to pin the client. Please try again."
}
```

- [ ] **Step 2: Create `IndividualClientsTab.tsx`**

Create `frontend/components/clients/IndividualClientsTab.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserRound } from "lucide-react";
import { api, tokenManager } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface IndividualUser {
    id: number;
    full_name: string;
    email: string;
    role: string;
}

interface ClientOrg {
    id: number;
    name: string;
}

interface TeamOption {
    id: number;
    name: string;
}

export default function IndividualClientsTab() {
    const t = useTranslations("clients");
    const me = tokenManager.getUser();

    const [individuals, setIndividuals] = useState<IndividualUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientOrgs, setClientOrgs] = useState<ClientOrg[]>([]);

    // Pin modal state
    const [pinTarget, setPinTarget] = useState<IndividualUser | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState<number | "new" | "">("");
    const [newOrgName, setNewOrgName] = useState("");
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | "">("");
    const [pinning, setPinning] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (!me) return;
        setLoading(true);
        try {
            const [users, orgs] = await Promise.all([
                api.users.list(undefined, me.organization_id),
                api.auth.getMyOrganizations(),
            ]);
            setIndividuals(users.filter((u: IndividualUser) => u.id !== me.id && u.role === "user"));
            setClientOrgs(orgs);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { load(); }, [load]);

    // Load teams whenever an existing org is selected in the modal
    useEffect(() => {
        setSelectedTeamId("");
        if (typeof selectedOrgId === "number") {
            api.teams.list(selectedOrgId).then((ts) => setTeams(ts.map((x) => ({ id: x.id, name: x.name }))));
        } else {
            setTeams([]);
        }
    }, [selectedOrgId]);

    const handlePin = async () => {
        if (!pinTarget) return;
        setPinning(true);
        setError("");
        try {
            let orgId: number;
            if (selectedOrgId === "new") {
                const org = await api.organizations.create({ name: newOrgName });
                orgId = org.id;
            } else if (typeof selectedOrgId === "number") {
                orgId = selectedOrgId;
            } else {
                setPinning(false);
                return;
            }
            await api.users.moveOrganization(pinTarget.id, {
                organization_id: orgId,
                team_id: typeof selectedTeamId === "number" ? selectedTeamId : undefined,
            });
            setPinTarget(null);
            setSelectedOrgId("");
            setNewOrgName("");
            await load();
        } catch {
            setError(t("error"));
        } finally {
            setPinning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (individuals.length === 0) {
        return <p className="text-slate-500 text-sm py-8 text-center">{t("empty")}</p>;
    }

    return (
        <div className="space-y-3">
            {individuals.map((u) => (
                <div
                    key={u.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <UserRound className="h-5 w-5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{u.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPinTarget(u)}>
                        {t("pin")}
                    </Button>
                </div>
            ))}

            {pinTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900">
                            {t("pinTitle", { name: pinTarget.full_name })}
                        </h3>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700">{t("pinExisting")}</label>
                            <select
                                value={selectedOrgId}
                                onChange={(e) =>
                                    setSelectedOrgId(e.target.value === "new" ? "new" : e.target.value ? Number(e.target.value) : "")
                                }
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                            >
                                <option value="">—</option>
                                {clientOrgs.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                                <option value="new">{t("pinNew")}</option>
                            </select>
                        </div>
                        {selectedOrgId === "new" && (
                            <input
                                type="text" placeholder={t("pinNewName")}
                                value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                            />
                        )}
                        {typeof selectedOrgId === "number" && teams.length > 0 && (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700">{t("pinTeam")}</label>
                                <select
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : "")}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                                >
                                    <option value="">{t("pinNoTeam")}</option>
                                    {teams.map((tm) => (
                                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {error && <p className="text-sm text-rose-600">{error}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setPinTarget(null)}>{t("cancel")}</Button>
                            <Button
                                onClick={handlePin}
                                disabled={pinning || selectedOrgId === "" || (selectedOrgId === "new" && !newOrgName)}
                            >
                                {pinning ? t("pinning") : t("pinConfirm")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
```

Adapt types to the actual `api.users.list` / `api.teams.list` return shapes while implementing.

- [ ] **Step 3: Tabs on the organizations page (coach only)**

In `frontend/app/(dashboard)/dashboard/organizations/page.tsx`:

1. Import: `import IndividualClientsTab from "@/components/clients/IndividualClientsTab";` and `tokenManager` (if missing).
2. Add state: `const [activeTab, setActiveTab] = useState<"orgs" | "individuals">("orgs");` and `const isCoach = tokenManager.getUser()?.role === "coach";` plus `const tClients = useTranslations("clients");`.
3. Below the page header, render tabs for coach:

```tsx
{isCoach && (
    <div className="flex gap-2 border-b border-slate-200 mb-6">
        {(["orgs", "individuals"] as const).map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                    activeTab === tab
                        ? "px-4 py-2 text-sm font-semibold text-primary border-b-2 border-primary"
                        : "px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                }
            >
                {tab === "orgs" ? tClients("tabOrgs") : tClients("tabIndividuals")}
            </button>
        ))}
    </div>
)}
```

4. Wrap the existing org-list content in `{(!isCoach || activeTab === "orgs") && (<>...existing content...</>)}` and add `{isCoach && activeTab === "individuals" && <IndividualClientsTab />}`.

- [ ] **Step 4: Verify + commit**

Run: `cd frontend && npm run build && npm run lint`
Expected: pass.

Manual smoke: as coach with an individual client → Klienci → Indywidualni shows the person; pin them to a new org with a team → the person disappears from the tab and appears in the client org's team.

```bash
git add frontend/components/clients/IndividualClientsTab.tsx "frontend/app/(dashboard)/dashboard/organizations/page.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): clients view with individuals tab and pin-to-organization"
```

---

### Task 10: Final verification & docs

**Files:**
- Modify: `docs/PRODUCT_FEATURES.md`

**Interfaces:**
- Consumes: everything above.
- Produces: green suite, updated feature map, branch ready for review.

- [ ] **Step 1: Full backend suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all PASSED (except the known pre-existing `test_extract_ranked_talents_pl` parser bug, if still unfixed).

- [ ] **Step 2: Frontend build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: pass.

- [ ] **Step 3: End-to-end smoke test**

With `npm run dev` + local backend running:
1. `/register/coach` → register → wizard.
2. Individual path: person + PDF → profile with talents; person visible in Klienci → Indywidualni.
3. Pin the person to a new client org with a team → visible in team, gone from Indywidualni.
4. Org path: client → team → invite person (email mode) → status "Invited" on team page.
5. Coach sidebar: no Moje Talenty, no Daily Tip, "Klienci" label, client switcher works, workspace absent from switcher.
6. Regular member account: everything unchanged (sidebar, my-talents, tips, onboarding screen).

- [ ] **Step 4: Update the feature map**

In `docs/PRODUCT_FEATURES.md` section "1. Infrastruktura & Auth", add rows:

```markdown
| ✅ | Rejestracja coacha (self-serve) | `/register/coach` — konto COACH + prywatny workspace |
| ✅ | Onboarding coacha (kreator) | Klient indywidualny lub organizacja → zespół → osoby → matryca |
| ✅ | Klienci indywidualni coacha | Zakładka Indywidualni + przypinanie do organizacji (move) |
| ✅ | UI zawężone dla roli COACH | Ukryte Moje Talenty / Mój Ruch; selektor klienta |
```

Update the "Ostatnia aktualizacja" date at the top to `2026-07-03`.

- [ ] **Step 5: Commit**

```bash
git add docs/PRODUCT_FEATURES.md
git commit -m "docs: update feature map with coach onboarding"
```

Then follow the superpowers:finishing-a-development-branch skill (merge vs PR decision belongs to the user).
