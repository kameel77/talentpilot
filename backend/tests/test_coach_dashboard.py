"""Tests for GET /api/dashboard/coach-overview."""
from auth import hash_password
from models import (
    GallupDomain,
    Organization,
    PlanTier,
    Talent,
    Team,
    User,
    UserRole,
    UserTalent,
)


def _register_coach(client, email="coach@example.com", full_name="Anna Kowalska"):
    """Helper: register a coach via self-serve endpoint, return auth headers."""
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _make_unlimited(db_session, email):
    """Bump a coach's workspace to an unlimited plan so tests that create
    multiple client orgs to exercise aggregation logic (not billing) don't
    trip the FREE plan's 1 client-org limit (docs/BRIEF_BILLING_TRIAL.md §8).
    """
    coach = db_session.query(User).filter(User.email == email).first()
    org = db_session.query(Organization).filter(Organization.id == coach.organization_id).first()
    org.plan = PlanTier.PRO
    db_session.commit()


def _add_user(db_session, org_id, email, with_talent=None):
    """Helper: create an active user in org; optionally attach one talent."""
    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name=email.split("@")[0].title(),
        role=UserRole.USER,
        organization_id=org_id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    if with_talent is not None:
        db_session.add(UserTalent(user_id=user.id, talent_id=with_talent.id, rank=1))
        db_session.commit()
    return user


def _make_talent(db_session, code="achiever"):
    talent = Talent(code=code, domain=GallupDomain.EXECUTING)
    db_session.add(talent)
    db_session.commit()
    db_session.refresh(talent)
    return talent


def test_coach_overview_aggregates_clients_and_individuals(client, db_session):
    headers = _register_coach(client)
    _make_unlimited(db_session, "coach@example.com")
    talent = _make_talent(db_session)

    # Two client orgs created by the coach (auto-granted OrganizationAccess)
    org_a = client.post("/api/organizations", json={"name": "Acme"}, headers=headers).json()
    org_b = client.post("/api/organizations", json={"name": "Beta"}, headers=headers).json()

    # Acme: 2 members, 1 with talents, 1 team
    _add_user(db_session, org_a["id"], "a1@acme.com", with_talent=talent)
    _add_user(db_session, org_a["id"], "a2@acme.com")
    db_session.add(Team(name="Acme Team", organization_id=org_a["id"]))
    db_session.commit()

    # Beta: 1 member, no talents, no teams
    _add_user(db_session, org_b["id"], "b1@beta.com")

    # One individual client (in the coach's workspace), with talents
    coach = db_session.query(User).filter(User.email == "coach@example.com").first()
    _add_user(db_session, coach.organization_id, "indiv@example.com", with_talent=talent)

    response = client.get("/api/dashboard/coach-overview", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert [c["name"] for c in data["clients"]] == ["Acme", "Beta"]
    acme = data["clients"][0]
    assert acme == {
        "id": org_a["id"], "name": "Acme",
        "members": 2, "teams": 1, "users_with_talents": 1,
    }
    beta = data["clients"][1]
    assert beta["members"] == 1
    assert beta["teams"] == 0
    assert beta["users_with_talents"] == 0

    assert data["individual_clients"] == 1
    assert data["individual_clients_with_talents"] == 1
    assert data["totals"] == {
        "clients": 2, "teams": 1, "people": 4, "users_with_talents": 2,
    }


def test_coach_overview_excludes_workspace_from_clients(client, db_session):
    headers = _register_coach(client, email="w@example.com", full_name="W Coach")
    client.post("/api/organizations", json={"name": "RealClient"}, headers=headers)

    data = client.get("/api/dashboard/coach-overview", headers=headers).json()
    names = [c["name"] for c in data["clients"]]
    assert names == ["RealClient"]
    assert all("Coaching" not in n for n in names)


def test_coach_overview_empty_state(client):
    headers = _register_coach(client, email="e@example.com", full_name="Empty Coach")
    data = client.get("/api/dashboard/coach-overview", headers=headers).json()
    assert data["clients"] == []
    assert data["individual_clients"] == 0
    assert data["totals"] == {"clients": 0, "teams": 0, "people": 0, "users_with_talents": 0}


def test_coach_overview_forbidden_for_non_coach(client, auth_headers_admin, auth_headers_user):
    for headers in (auth_headers_admin, auth_headers_user):
        response = client.get("/api/dashboard/coach-overview", headers=headers)
        assert response.status_code == 403


def test_coach_overview_first_steps_empty_for_new_coach(client):
    headers = _register_coach(client, email="fresh@example.com")
    response = client.get("/api/dashboard/coach-overview", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["first_steps"] == {
        "presentation_links": 0,
        "qa_queries": 0,
        "suggested_team": None,
    }


def test_coach_overview_first_steps_reflects_teams_presentations_and_queries(client, db_session):
    from models import UserQuery, user_teams

    headers = _register_coach(client, email="steps@example.com")
    _make_unlimited(db_session, "steps@example.com")
    coach = db_session.query(User).filter(User.email == "steps@example.com").first()

    org = client.post("/api/organizations", json={"name": "Acme"}, headers=headers).json()
    small = Team(name="Small", organization_id=org["id"])
    big = Team(name="Big", organization_id=org["id"], presentation_token="tok-123")
    db_session.add_all([small, big])
    db_session.commit()
    members = [_add_user(db_session, org["id"], f"m{i}@acme.com") for i in range(3)]
    db_session.execute(user_teams.insert(), [{"user_id": m.id, "team_id": big.id} for m in members])
    db_session.execute(user_teams.insert(), [{"user_id": members[0].id, "team_id": small.id}])
    db_session.add(UserQuery(
        user_id=coach.id,
        organization_id=coach.organization_id,
        question="Jak pracować z Anną?",
        question_hash="h1",
        embedding=[0.1] * 1536,
    ))
    db_session.commit()

    # A team in an org the coach has no access to must not leak into the result
    stranger_org = Organization(name="Stranger")
    db_session.add(stranger_org)
    db_session.commit()
    db_session.add(Team(name="Foreign", organization_id=stranger_org.id, presentation_token="tok-x"))
    db_session.commit()

    steps = client.get("/api/dashboard/coach-overview", headers=headers).json()["first_steps"]
    assert steps["presentation_links"] == 1
    assert steps["qa_queries"] == 1
    assert steps["suggested_team"] == {
        "id": big.id,
        "organization_id": org["id"],
        "name": "Big",
        "members": 3,
    }
