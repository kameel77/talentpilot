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
