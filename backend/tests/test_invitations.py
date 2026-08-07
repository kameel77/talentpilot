"""Tests for invitation flow: ghost invite creates user + sends email + sets invited_at."""
import pytest
from unittest.mock import patch
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


def test_ghost_invite_does_not_send_email(client, coach_headers, test_team, db_session):
    """Ghost invite creation does NOT send email — coach sends invitation manually."""
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
    data = response.json()
    user = db_session.query(User).filter(User.id == data["user_id"]).first()
    assert user.invited_at is None


@patch("routers.users.send_invitation_email")
def test_resend_uses_org_language(mock_send, client, db_session, test_org, test_team, coach_headers):
    """Resend invitation uses the org's language setting."""
    import secrets
    import hashlib
    from models import TeamInvitation, InvitationStatus

    test_org.language = "en"
    db_session.commit()

    ghost = User(
        email="lang@example.com",
        hashed_password="x",
        full_name="Lang User",
        role=UserRole.USER,
        is_active=False,
        is_ghost=True,
        organization_id=test_org.id,
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

    client.post(f"/api/users/{ghost.id}/resend-invitation", headers=coach_headers)
    assert mock_send.call_args.kwargs["language"] == "en"


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


def test_compute_invitation_status_not_invited():
    """Ghost user with no invited_at is 'not_invited' — email not sent yet."""
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = False
        invited_at = None

    assert compute_invitation_status(FakeUser()) == "not_invited"


def test_compute_invitation_status_naive_datetime():
    """Timezone-naive invited_at (as returned by SQLite) must not raise TypeError."""
    from routers.invitations import compute_invitation_status

    class FakeUser:
        is_active = False
        # naive datetime — SQLite strips tzinfo on read
        invited_at = datetime.utcnow() - timedelta(days=8)

    assert compute_invitation_status(FakeUser()) == "expired"


@patch("routers.users.send_invitation_email")
def test_resend_invitation(mock_send, client, db_session, test_org, test_team, coach_headers):
    """Resend endpoint re-sends email and resets invited_at."""
    import secrets
    import hashlib
    from models import TeamInvitation, InvitationStatus
    from datetime import datetime, timedelta, timezone

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


def test_ghost_invite_without_email(client, coach_headers, test_team, db_session):
    """Ghost invite can be created without email address."""
    response = client.post(
        "/api/invitations/ghost",
        json={
            "full_name": "No Email User",
            "team_id": test_team.id,
        },
        headers=coach_headers,
    )
    assert response.status_code == 201
    data = response.json()
    user = db_session.query(User).filter(User.id == data["user_id"]).first()
    assert user is not None
    assert "placeholder.talentpilot.local" in user.email


def test_resend_invitation_placeholder_email_fails(client, coach_headers, test_team, db_session):
    """Resending invitation to a placeholder email user returns 400."""
    import secrets
    import hashlib
    from models import TeamInvitation, InvitationStatus

    ghost = User(
        email="ghost+12345@placeholder.talentpilot.local",
        hashed_password="x",
        full_name="Placeholder User",
        role=UserRole.USER,
        is_active=False,
        is_ghost=True,
        organization_id=test_team.organization_id,
    )
    db_session.add(ghost)
    db_session.flush()

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

    response = client.post(
        f"/api/users/{ghost.id}/resend-invitation",
        headers=coach_headers,
    )
    assert response.status_code == 400
    assert "User has no email address" in response.json()["detail"]


def test_ghost_creation_assigns_public_token_and_resolves_profile(client, coach_headers, test_team):
    """Ghost creation assigns public_token and public profile resolves for ghost user (is_ghost=True)."""
    payload = {
        "full_name": "Ghost Share Test",
        "job_title": "Klient Testowy",
        "team_id": test_team.id,
    }
    response = client.post("/api/invitations/ghost", json=payload, headers=coach_headers)
    assert response.status_code == 201
    data = response.json()

    public_token = data.get("public_token")
    assert public_token is not None
    assert len(public_token) == 32

    # Fetch public profile using public_token
    public_res = client.get(f"/api/public/{public_token}")
    assert public_res.status_code == 200
    profile = public_res.json()
    assert profile["full_name"] == "Ghost Share Test"


def test_public_profile_non_existent_token_returns_404(client):
    """Public profile endpoint returns 404 for random invalid token."""
    response = client.get("/api/public/invalid_token_99999999999999999")
    assert response.status_code == 404


