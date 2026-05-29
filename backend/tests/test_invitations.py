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

    data = response.json()
    user = db_session.query(User).filter(User.id == data["user_id"]).first()
    assert user.invited_at is not None


@patch("routers.invitations.send_invitation_email")
def test_ghost_invite_uses_org_language(mock_send, client, coach_headers, test_team, db_session):
    """Email is sent in the organization's language."""
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
