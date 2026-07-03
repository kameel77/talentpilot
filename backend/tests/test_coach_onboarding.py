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
