"""Tests for coach self-serve registration, workspace filtering, and client management."""
import pytest

from models import Organization, PlanTier, User, UserRole


def _make_unlimited(db_session, email):
    """Bump a coach's workspace to an unlimited plan.

    Several onboarding tests create more than one client org for a single
    coach purely to exercise unrelated behavior (org listing, team moves,
    etc) — not to test billing. FREE plan defaults to a 1 client-org limit
    (docs/BRIEF_BILLING_TRIAL.md §8), so those tests need a paid plan to
    avoid tripping the 402 they aren't testing for.
    """
    coach = db_session.query(User).filter(User.email == email).first()
    org = db_session.query(Organization).filter(Organization.id == coach.organization_id).first()
    org.plan = PlanTier.PRO
    db_session.commit()


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


def test_my_organizations_excludes_coach_workspace(client, db_session):
    _, headers = _register_coach(client, email="wcoach@example.com", full_name="W Coach")
    _make_unlimited(db_session, "wcoach@example.com")

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


def _activate_ghost(db_session, user_id, password="clientpass123"):
    """Activate a ghost-invited user directly in the DB (bypasses invitation-accept flow)."""
    from auth import hash_password

    user = db_session.query(User).filter(User.id == user_id).first()
    user.hashed_password = hash_password(password)
    user.is_active = True
    user.is_ghost = False
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers_for(user):
    from auth import create_access_token

    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


def test_workspace_individuals_cannot_see_each_other(client, db_session):
    """Two unrelated individual clients (strangers) in the same coach workspace
    must not be able to read each other's data via ID-addressable endpoints."""
    _, headers = _register_coach(client, email="stcoach@example.com", full_name="St Coach")
    me = _me(client, headers)
    org_id = me["organization_id"]

    a_id = _create_individual(client, headers, org_id, email="stranger_a@example.com")
    b_id = _create_individual(client, headers, org_id, email="stranger_b@example.com")

    user_a = _activate_ghost(db_session, a_id)
    _activate_ghost(db_session, b_id)

    a_headers = _auth_headers_for(user_a)

    resp = client.get(f"/api/users/{b_id}", headers=a_headers)
    assert resp.status_code in (403, 404)

    resp = client.get(f"/api/users/{b_id}/talents", headers=a_headers)
    assert resp.status_code in (403, 404)

    resp = client.get(f"/api/compare/{a_id}/{b_id}", headers=a_headers)
    assert resp.status_code in (403, 404)

    resp = client.get(f"/api/tips/synergy/{b_id}", headers=a_headers)
    assert resp.status_code in (403, 404)


def test_teammates_can_still_see_each_other(client, db_session, test_organization):
    """Two USERs sharing a team in a real org must retain full access to each other."""
    from models import Team
    from auth import hash_password

    team = Team(name="Shared Team", organization_id=test_organization.id)
    db_session.add(team)
    db_session.commit()
    db_session.refresh(team)

    user_a = User(
        email="teammate_a@example.com",
        hashed_password=hash_password("password123"),
        full_name="Teammate A",
        role=UserRole.USER,
        organization_id=test_organization.id,
        is_active=True,
    )
    user_b = User(
        email="teammate_b@example.com",
        hashed_password=hash_password("password123"),
        full_name="Teammate B",
        role=UserRole.USER,
        organization_id=test_organization.id,
        is_active=True,
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    team.members.append(user_a)
    team.members.append(user_b)
    db_session.commit()

    a_headers = _auth_headers_for(user_a)

    resp = client.get(f"/api/users/{user_b.id}", headers=a_headers)
    assert resp.status_code == 200

    resp = client.get(f"/api/compare/{user_a.id}/{user_b.id}", headers=a_headers)
    assert resp.status_code not in (403, 404)


def test_user_can_see_self(client, auth_headers_user, test_user):
    resp = client.get(f"/api/users/{test_user.id}", headers=auth_headers_user)
    assert resp.status_code == 200


def test_move_team_must_belong_to_target_org(client, db_session):
    _, headers = _register_coach(client, email="tcoach@example.com", full_name="T Coach")
    _make_unlimited(db_session, "tcoach@example.com")
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


def test_register_coach_workspace_flagged(client, db_session):
    _, headers = _register_coach(client, email="flagcoach@example.com", full_name="Flag Coach")
    me = _me(client, headers)

    workspace = (
        db_session.query(Organization)
        .filter(Organization.id == me["organization_id"])
        .first()
    )
    assert workspace.is_workspace is True


def test_cannot_create_team_in_workspace(client):
    _, headers = _register_coach(client, email="wteamcoach@example.com", full_name="W Team Coach")
    me = _me(client, headers)

    response = client.post(
        "/api/teams",
        json={"name": "Sneaky Team", "organization_id": me["organization_id"]},
        headers=headers,
    )
    assert response.status_code == 400


def test_can_still_create_team_in_client_org(client):
    _, headers = _register_coach(client, email="cteamcoach@example.com", full_name="C Team Coach")

    org = client.post("/api/organizations", json={"name": "Client Org Team Test"}, headers=headers).json()
    response = client.post(
        "/api/teams",
        json={"name": "Client Team", "organization_id": org["id"]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
