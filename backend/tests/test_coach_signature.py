"""Coach signature on client-facing public artefacts (brief #4, B)."""
from models import Team, User


def _register_coach(client, email="sig-coach@example.com", full_name="Ewa Coach"):
    res = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _coach(db_session, email="sig-coach@example.com") -> User:
    return db_session.query(User).filter(User.email == email).one()


def _individual_client(client, headers, coach: User, name="Jan Kowalski"):
    res = client.post(
        "/api/invitations/ghost",
        json={"full_name": name, "organization_id": coach.organization_id},
        headers=headers,
    )
    assert res.status_code in (200, 201), res.text
    return res.json()


def test_individual_client_profile_carries_coach_signature(client, db_session):
    headers = _register_coach(client)
    coach = _coach(db_session)
    coach.gallup_certified = True
    coach.phone = "+48 600 000 000"
    coach.linkedin_url = "https://linkedin.com/in/ewa"
    db_session.commit()
    ghost = _individual_client(client, headers, coach)

    data = client.get(f"/api/public/{ghost['public_token']}").json()
    sig = data["prepared_by"]
    assert sig["full_name"] == "Ewa Coach"
    assert sig["gallup_certified"] is True
    assert sig["email"] == "sig-coach@example.com"
    assert sig["phone"] == "+48 600 000 000"
    assert sig["linkedin_url"] == "https://linkedin.com/in/ewa"
    assert sig["profile_handle"] == coach.public_token


def test_signature_respects_coach_privacy_settings_and_opt_out(client, db_session):
    headers = _register_coach(client)
    coach = _coach(db_session)
    coach.gallup_certified = True
    coach.phone = "+48 600 000 000"
    coach.public_profile_settings = {"show_email": False, "show_phone": False, "show_certification": False}
    db_session.commit()
    ghost = _individual_client(client, headers, coach)

    sig = client.get(f"/api/public/{ghost['public_token']}").json()["prepared_by"]
    assert sig["email"] is None
    assert sig["phone"] is None
    assert sig["gallup_certified"] is False

    coach.public_profile_settings = {"show_coach_signature": False}
    db_session.commit()
    assert client.get(f"/api/public/{ghost['public_token']}").json()["prepared_by"] is None


def test_coach_own_profile_has_no_signature(client, db_session):
    _register_coach(client)
    coach = _coach(db_session)
    assert client.get(f"/api/public/{coach.public_token}").json()["prepared_by"] is None


def test_client_org_member_and_presentation_carry_signature_without_contact(client, db_session):
    headers = _register_coach(client)
    coach = _coach(db_session)
    coach.gallup_certified = True
    db_session.commit()

    org = client.post("/api/organizations", json={"name": "Acme"}, headers=headers).json()
    team = client.post("/api/teams", json={"name": "Core", "organization_id": org["id"]}, headers=headers).json()
    member = client.post(
        "/api/invitations/ghost", json={"full_name": "Anna Nowak", "team_id": team["id"]}, headers=headers
    ).json()

    profile = client.get(f"/api/public/{member['public_token']}").json()
    assert profile["prepared_by"]["full_name"] == "Ewa Coach"

    db_team = db_session.query(Team).filter(Team.id == team["id"]).one()
    db_team.presentation_token = "sig-presentation-token"
    db_session.commit()
    res = client.get("/api/public/presentations/sig-presentation-token")
    assert res.status_code == 200, res.text
    assert res.json()["prepared_by"] == {
        "full_name": "Ewa Coach",
        "gallup_certified": True,
        "profile_handle": coach.public_token,
    }
    # The presentation endpoint's zero-PII contract still holds
    assert "@" not in res.text and "email" not in res.text


def test_org_without_coach_has_no_signature(client, db_session, test_organization):
    team = Team(name="No coach", organization_id=test_organization.id, presentation_token="nocoach-token")
    db_session.add(team)
    db_session.commit()
    res = client.get("/api/public/presentations/nocoach-token")
    assert res.status_code == 200
    assert res.json()["prepared_by"] is None


def test_presentation_includes_ghost_members_added_by_coach(client, db_session):
    """People a coach imports from PDFs are ghost profiles; they must appear
    in the team presentation (regression: they were filtered out as inactive)."""
    from models import Talent, UserTalent, GallupDomain

    headers = _register_coach(client, email="ghost-pres@example.com")
    org = client.post("/api/organizations", json={"name": "Acme"}, headers=headers).json()
    team = client.post("/api/teams", json={"name": "Core", "organization_id": org["id"]}, headers=headers).json()
    talent = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    db_session.add(talent)
    db_session.commit()

    ghost = client.post(
        "/api/invitations/ghost", json={"full_name": "Anna Nowak", "team_id": team["id"]}, headers=headers
    ).json()
    db_session.add(UserTalent(user_id=ghost["user_id"], talent_id=talent.id, rank=1))

    # A deactivated real account in the same team stays hidden
    from auth import hash_password
    from models import user_teams
    inactive = User(
        email="gone@acme.com", hashed_password=hash_password("password123"), full_name="Gone",
        organization_id=org["id"], is_active=False, is_ghost=False,
    )
    db_session.add(inactive)
    db_session.commit()
    db_session.execute(user_teams.insert(), [{"user_id": inactive.id, "team_id": team["id"]}])
    db_session.add(UserTalent(user_id=inactive.id, talent_id=talent.id, rank=1))
    db_team = db_session.query(Team).filter(Team.id == team["id"]).one()
    db_team.presentation_token = "ghost-pres-token"
    db_session.commit()

    members = client.get("/api/public/presentations/ghost-pres-token").json()["members"]
    assert [m["display_name"] for m in members] == ["Anna Nowak"]
