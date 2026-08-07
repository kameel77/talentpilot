"""Tests for organization upgrade endpoint (personal workspace -> full organization)."""
import pytest
from models import User, Organization, UserRole, Team
from auth import create_access_token


def test_upgrade_personal_workspace_success(client, db_session):
    """Test upgrading a personal workspace converts it to a full organization."""
    # Setup personal workspace and admin user
    org = Organization(name="Jan Kowalski — Moje konto", is_workspace=True, name_confirmed=False)
    db_session.add(org)
    db_session.flush()

    user = User(
        email="jan@example.com",
        hashed_password="hash",
        full_name="Jan Kowalski",
        role=UserRole.ADMIN,
        organization_id=org.id,
    )
    db_session.add(user)
    db_session.commit()

    token = create_access_token(data={"sub": user.id})
    headers = {"Authorization": f"Bearer {token}"}

    # Execute upgrade
    payload = {"name": "Nowa Firma Sp. z o.o."}
    response = client.post(f"/api/organizations/{org.id}/upgrade", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Nowa Firma Sp. z o.o."
    assert data["is_workspace"] is False
    assert data["name_confirmed"] is True

    # Assert database state
    db_session.refresh(org)
    assert org.name == "Nowa Firma Sp. z o.o."
    assert org.is_workspace is False
    assert org.name_confirmed is True


def test_upgrade_coach_workspace_forbidden(client, db_session):
    """Test upgrading a coach workspace returns 403 Forbidden even when called by an admin."""
    org = Organization(name="Coach Workspace", is_workspace=True, name_confirmed=True)
    db_session.add(org)
    db_session.flush()

    coach = User(
        email="coach@example.com",
        hashed_password="hash",
        full_name="Jan Coach",
        role=UserRole.COACH,
        organization_id=org.id,
    )
    admin_in_org = User(
        email="admin_coach_org@example.com",
        hashed_password="hash",
        full_name="Admin Coach Org",
        role=UserRole.ADMIN,
        organization_id=org.id,
    )
    db_session.add_all([coach, admin_in_org])
    db_session.commit()

    token = create_access_token(data={"sub": admin_in_org.id})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"name": "Coach Org"}
    response = client.post(f"/api/organizations/{org.id}/upgrade", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Coach workspaces cannot be converted" in response.json()["detail"]


def test_upgrade_already_normal_org_bad_request(client, db_session):
    """Test upgrading an already normal organization returns 400 Bad Request."""
    org = Organization(name="Existing Corp", is_workspace=False, name_confirmed=True)
    db_session.add(org)
    db_session.flush()

    admin = User(
        email="admin@example.com",
        hashed_password="hash",
        full_name="Admin User",
        role=UserRole.ADMIN,
        organization_id=org.id,
    )
    db_session.add(admin)
    db_session.commit()

    token = create_access_token(data={"sub": admin.id})
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"name": "New Corp Name"}
    response = client.post(f"/api/organizations/{org.id}/upgrade", json=payload, headers=headers)
    assert response.status_code == 400


def test_create_team_succeeds_after_upgrade(client, db_session):
    """Test team creation fails in workspace, but succeeds after upgrade."""
    org = Organization(name="Moje Konto", is_workspace=True, name_confirmed=False)
    db_session.add(org)
    db_session.flush()

    admin = User(
        email="admin_team@example.com",
        hashed_password="hash",
        full_name="Admin Team",
        role=UserRole.ADMIN,
        organization_id=org.id,
    )
    db_session.add(admin)
    db_session.commit()

    token = create_access_token(data={"sub": admin.id})
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt team creation in workspace -> fails (400)
    team_payload = {"name": "Zespół Alpha"}
    fail_res = client.post("/api/teams", json=team_payload, headers=headers)
    assert fail_res.status_code == 400
    assert "workspace" in fail_res.json()["detail"].lower()

    # Perform upgrade
    upgrade_res = client.post(f"/api/organizations/{org.id}/upgrade", json={"name": "Firma Alpha"}, headers=headers)
    assert upgrade_res.status_code == 200

    # Attempt team creation after upgrade -> succeeds (201)
    success_res = client.post("/api/teams", json=team_payload, headers=headers)
    assert success_res.status_code == 201
    assert success_res.json()["name"] == "Zespół Alpha"
