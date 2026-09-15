"""Tests for Public Team Presentation Link and Management Endpoints.

docs/superpowers/specs/2026-09-15-public-team-matrix-link-design.md
Covers:
- Role & org security checks on /api/teams/{id}/presentation-link (GET, POST, PATCH, DELETE)
- Token rotation on POST
- Anonymization update on PATCH without token rotation
- Revocation on DELETE
- Public GET /api/public/presentations/{token} matrix payload, zero PII, member sorting
- Server-side anonymization
- Talent translations (SSoT) per lang
- Rate limiting (30 req/min/IP) and anti-spoofing against X-Forwarded-For tampering
"""
import pytest
from auth import create_access_token, hash_password
from models import (
    GallupDomain,
    Organization,
    Talent,
    TalentTranslation,
    Team,
    User,
    UserRole,
    UserTalent,
)
from rate_limiter import reset_rate_limiter


@pytest.fixture(autouse=True)
def clean_rate_limiter():
    """Ensure clean rate limiter state for every test."""
    reset_rate_limiter()
    yield
    reset_rate_limiter()


@pytest.fixture
def seed_talents(db_session):
    """Seed sample CliftonStrengths talents with PL and EN translations."""
    talents_data = [
        ("achiever", GallupDomain.EXECUTING, "Osiąganie", "Achiever"),
        ("activator", GallupDomain.INFLUENCING, "Aktywator", "Activator"),
        ("empathy", GallupDomain.RELATIONSHIP_BUILDING, "Empatia", "Empathy"),
        ("strategic", GallupDomain.STRATEGIC_THINKING, "Strateg", "Strategic"),
        ("focus", GallupDomain.EXECUTING, "Ukierunkowanie", "Focus"),
    ]
    created = []
    for code, domain, name_pl, name_en in talents_data:
        t = Talent(code=code, domain=domain)
        db_session.add(t)
        db_session.flush()
        db_session.add(TalentTranslation(talent_id=t.id, language="pl", name=name_pl, description="Opis"))
        db_session.add(TalentTranslation(talent_id=t.id, language="en", name=name_en, description="Description"))
        created.append(t)
    db_session.commit()
    return created


@pytest.fixture
def sample_team_setup(db_session, test_organization, seed_talents):
    """Setup a team with manager, members, and talents."""
    admin_user = User(
        email="admin_org1@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Admin Jeden",
        role=UserRole.ADMIN,
        organization_id=test_organization.id,
    )
    manager_user = User(
        email="manager@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Beata Kierowniczka",
        role=UserRole.MANAGER,
        organization_id=test_organization.id,
    )
    # Give member 1 (higher id than member 2 or specific alphabetical vs id order)
    # Adam (id 3) vs Zenon (id 4)
    member_a = User(
        email="adam@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Adam Adamski",
        role=UserRole.USER,
        organization_id=test_organization.id,
    )
    member_z = User(
        email="zenon@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Zenon Zieliński",
        role=UserRole.USER,
        organization_id=test_organization.id,
    )
    inactive_user = User(
        email="inactive@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Ignacy Nieaktywny",
        role=UserRole.USER,
        organization_id=test_organization.id,
        is_active=False,
    )
    user_no_talents = User(
        email="notalents@example.com",
        hashed_password=hash_password("pass123"),
        full_name="Norbert Beztalencia",
        role=UserRole.USER,
        organization_id=test_organization.id,
    )

    db_session.add_all([admin_user, manager_user, member_a, member_z, inactive_user, user_no_talents])
    db_session.commit()

    team = Team(
        name="Zespół Alfa",
        organization_id=test_organization.id,
        manager_id=manager_user.id,
    )
    team.members.extend([manager_user, member_a, member_z, inactive_user, user_no_talents])
    db_session.add(team)
    db_session.commit()

    # Add talents
    # manager
    db_session.add(UserTalent(user_id=manager_user.id, talent_id=seed_talents[0].id, rank=1))
    db_session.add(UserTalent(user_id=manager_user.id, talent_id=seed_talents[1].id, rank=2))
    # member_a
    db_session.add(UserTalent(user_id=member_a.id, talent_id=seed_talents[2].id, rank=1))
    # member_z
    db_session.add(UserTalent(user_id=member_z.id, talent_id=seed_talents[3].id, rank=1))
    # inactive_user has talent but is inactive
    db_session.add(UserTalent(user_id=inactive_user.id, talent_id=seed_talents[4].id, rank=1))
    db_session.commit()

    return {
        "team": team,
        "admin": admin_user,
        "manager": manager_user,
        "member_a": member_a,
        "member_z": member_z,
        "inactive": inactive_user,
        "no_talents": user_no_talents,
    }


def _auth_header(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


# 1. test_presentation_link_requires_role
def test_presentation_link_requires_role(client, sample_team_setup):
    """User with role 'user' receives 403 on presentation link endpoints."""
    team = sample_team_setup["team"]
    user = sample_team_setup["member_a"]
    headers = _auth_header(user)

    # GET
    res_get = client.get(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_get.status_code == 403

    # POST
    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    assert res_post.status_code == 403

    # PATCH
    res_patch = client.patch(f"/api/teams/{team.id}/presentation-link", json={"anonymized": True}, headers=headers)
    assert res_patch.status_code == 403

    # DELETE
    res_delete = client.delete(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_delete.status_code == 403


# 2. test_presentation_link_cross_org_denied
def test_presentation_link_cross_org_denied(client, db_session, sample_team_setup):
    """Admin from another organization cannot manage presentation link (403)."""
    team = sample_team_setup["team"]
    org2 = Organization(name="Other Organization")
    db_session.add(org2)
    db_session.commit()

    admin_org2 = User(
        email="admin2@example.com",
        hashed_password=hash_password("pass"),
        full_name="Admin Dwa",
        role=UserRole.ADMIN,
        organization_id=org2.id,
    )
    # Note: ADMIN has access to all orgs in _accessible_org_ids if role==ADMIN.
    # But a MANAGER from org2 does NOT have access!
    manager_org2 = User(
        email="manager2@example.com",
        hashed_password=hash_password("pass"),
        full_name="Manager Dwa",
        role=UserRole.MANAGER,
        organization_id=org2.id,
    )
    db_session.add(admin_org2)
    db_session.add(manager_org2)
    db_session.commit()

    headers = _auth_header(manager_org2)
    res = client.get(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "Access denied to this team"

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    assert res_post.status_code == 403


# 3. test_presentation_link_rotates
def test_presentation_link_rotates(client, sample_team_setup):
    """Second POST creates a new token; previous token returns 404."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    # 1st creation
    res1 = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    token1 = data1["token"]
    assert token1 is not None

    # Public view with token1 works
    pub1 = client.get(f"/api/public/presentations/{token1}")
    assert pub1.status_code == 200

    # 2nd creation (rotation)
    res2 = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    token2 = data2["token"]
    assert token2 != token1

    # Old token now returns 404
    pub_old = client.get(f"/api/public/presentations/{token1}")
    assert pub_old.status_code == 404

    # New token works
    pub_new = client.get(f"/api/public/presentations/{token2}")
    assert pub_new.status_code == 200


# 4. test_presentation_link_patch_keeps_token
def test_presentation_link_patch_keeps_token(client, sample_team_setup):
    """PATCH changes anonymized, preserves token and created_at; link keeps working."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    # Create link
    res_init = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    assert res_init.status_code == 200
    init_data = res_init.json()
    token = init_data["token"]
    created_at = init_data["created_at"]
    assert init_data["anonymized"] is False

    # PATCH to anonymized = True
    res_patch = client.patch(f"/api/teams/{team.id}/presentation-link", json={"anonymized": True}, headers=headers)
    assert res_patch.status_code == 200
    patch_data = res_patch.json()
    assert patch_data["token"] == token
    assert patch_data["created_at"] == created_at
    assert patch_data["anonymized"] is True

    # Same token still works publicly, now returning anonymized data
    pub = client.get(f"/api/public/presentations/{token}")
    assert pub.status_code == 200
    assert pub.json()["anonymized"] is True


# 5. test_presentation_link_delete_revokes
def test_presentation_link_delete_revokes(client, sample_team_setup):
    """After DELETE, public GET returns 404 and team endpoint returns token: null."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    res_del = client.delete(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_del.status_code == 204

    # Public GET now 404
    res_pub = client.get(f"/api/public/presentations/{token}")
    assert res_pub.status_code == 404

    # Team GET returns token: null
    res_get = client.get(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["token"] is None


# 6. test_public_presentation_returns_matrix
def test_public_presentation_returns_matrix(client, sample_team_setup):
    """Public presentation returns correct members with talents, no NameError, and robots header."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    res = client.get(f"/api/public/presentations/{token}")
    assert res.status_code == 200
    assert res.headers.get("X-Robots-Tag") == "noindex, nofollow"

    data = res.json()
    assert data["team_name"] == "Zespół Alfa"
    assert data["organization_name"] == "Test Organization"
    assert data["anonymized"] is False
    # Members: manager, member_a, member_z (inactive and no_talents excluded)
    assert len(data["members"]) == 3
    # Check leader flag on manager
    manager_member = next(m for m in data["members"] if m["display_name"] == manager.full_name)
    assert manager_member["is_leader"] is True
    assert len(manager_member["results"]) == 2
    assert len(data["talents"]) == 5


# 7. test_public_presentation_leaks_no_pii
def test_public_presentation_leaks_no_pii(client, sample_team_setup):
    """Raw JSON text contains no emails, '@', 'nip', 'is_ghost', or 'invited_at'."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    res = client.get(f"/api/public/presentations/{token}")
    assert res.status_code == 200
    raw_text = res.text

    assert "@" not in raw_text
    assert "email" not in raw_text
    assert "nip" not in raw_text.lower()
    assert "is_ghost" not in raw_text
    assert "invited_at" not in raw_text


# 8. test_public_presentation_anonymized
def test_public_presentation_anonymized(client, sample_team_setup):
    """When anonymized, display_name == 'Osoba 1', org name is None, full_name not present."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": True}, headers=headers)
    token = res_post.json()["token"]

    res = client.get(f"/api/public/presentations/{token}")
    assert res.status_code == 200
    data = res.json()
    assert data["anonymized"] is True
    assert data["organization_name"] is None

    names = [m["display_name"] for m in data["members"]]
    assert "Osoba 1" in names
    assert "Osoba 2" in names
    assert "Osoba 3" in names
    assert "Beata Kierowniczka" not in res.text
    assert "Adam Adamski" not in res.text


# 9. test_public_presentation_anonymized_order_is_by_id
def test_public_presentation_anonymized_order_is_by_id(client, db_session, sample_team_setup):
    """Member numbering is determined by member.id ASC, not alphabetical name order."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": True}, headers=headers)
    token = res_post.json()["token"]

    res = client.get(f"/api/public/presentations/{token}")
    assert res.status_code == 200
    data = res.json()

    # Active members with talents sorted by id
    active_members = [
        m for m in team.members if m.is_active and len(m.user_talents) > 0
    ]
    active_members.sort(key=lambda m: m.id)

    # First member by id should have "Osoba 1" and matching results
    for idx, expected_member in enumerate(active_members, start=1):
        member_payload = data["members"][idx - 1]
        assert member_payload["display_name"] == f"Osoba {idx}"
        expected_ranks = [ut.rank for ut in sorted(expected_member.user_talents, key=lambda x: x.rank)]
        actual_ranks = [r["rank"] for r in member_payload["results"]]
        assert expected_ranks == actual_ranks


# 10. test_public_presentation_lang_en
def test_public_presentation_lang_en(client, sample_team_setup):
    """Query parameter lang=en returns English talent translations and 'Person X' labels when anonymized."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    # 1. Non-anonymized link
    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    res_pl = client.get(f"/api/public/presentations/{token}?lang=pl")
    assert res_pl.status_code == 200
    names_pl = [t["translation"]["name"] for t in res_pl.json()["talents"]]
    assert "Osiąganie" in names_pl

    res_en = client.get(f"/api/public/presentations/{token}?lang=en")
    assert res_en.status_code == 200
    names_en = [t["translation"]["name"] for t in res_en.json()["talents"]]
    assert "Achiever" in names_en
    assert "Osiąganie" not in names_en

    # 2. Anonymized link with lang=en and lang=pl
    client.patch(f"/api/teams/{team.id}/presentation-link", json={"anonymized": True}, headers=headers)
    res_anon_en = client.get(f"/api/public/presentations/{token}?lang=en")
    assert res_anon_en.status_code == 200
    names_anon_en = [m["display_name"] for m in res_anon_en.json()["members"]]
    assert "Person 1" in names_anon_en
    assert "Osoba 1" not in names_anon_en

    res_anon_pl = client.get(f"/api/public/presentations/{token}?lang=pl")
    assert res_anon_pl.status_code == 200
    names_anon_pl = [m["display_name"] for m in res_anon_pl.json()["members"]]
    assert "Osoba 1" in names_anon_pl
    assert "Person 1" not in names_anon_pl


# 11. test_public_presentation_unknown_token
def test_public_presentation_unknown_token(client):
    """Unknown token returns 404."""
    res = client.get("/api/public/presentations/non-existent-token-12345")
    assert res.status_code == 404
    assert res.json()["detail"] == "Presentation not found"


# 12. test_public_rate_limit
def test_public_rate_limit(client, sample_team_setup):
    """Exceeding 30 requests per minute from same IP returns 429 with Retry-After header."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    url = f"/api/public/presentations/{token}"

    # Send 30 requests - all should succeed
    for _ in range(30):
        r = client.get(url)
        assert r.status_code == 200

    # 31st request triggers rate limit
    r31 = client.get(url)
    assert r31.status_code == 429
    assert r31.headers.get("Retry-After") is not None
    assert int(r31.headers["Retry-After"]) >= 1


# 13. test_public_rate_limit_not_bypassable_by_xff
def test_public_rate_limit_not_bypassable_by_xff(client, sample_team_setup):
    """40 requests with randomized spoofed X-Forwarded-For still trigger 429 because peer IP is constant."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    res_post = client.post(f"/api/teams/{team.id}/presentation-link", json={"anonymized": False}, headers=headers)
    token = res_post.json()["token"]

    url = f"/api/public/presentations/{token}"

    # In TestClient, client.host is constant (e.g. 'testclient').
    # Attacker tries sending random fake X-Forwarded-For header values like "1.2.3.4", "5.6.7.8"
    # Because Traefik appends or our limiter checks the last element, or if only 1 element is provided,
    # let's test simulating Traefik behavior: "fake_client_ip, trusted_proxy_ip"
    statuses = []
    for i in range(40):
        fake_xff = f"192.168.1.{i}, 10.0.0.1"
        r = client.get(url, headers={"X-Forwarded-For": fake_xff})
        statuses.append(r.status_code)

    # First 30 requests should be 200
    assert statuses[:30] == [200] * 30
    # Remaining 10 requests should be 429 because last element (10.0.0.1) was constant
    assert statuses[30:] == [429] * 10


# 14. test_presentation_link_partial_patch_isolation_and_empty_patch
def test_presentation_link_partial_patch_isolation_and_empty_patch(client, sample_team_setup):
    """Partial PATCH modifies only the specified field without clearing the other; empty PATCH is a no-op."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    # Init: anonymized=True, show_risks=False
    res_init = client.post(
        f"/api/teams/{team.id}/presentation-link",
        json={"anonymized": True, "show_risks": False},
        headers=headers,
    )
    assert res_init.status_code == 200
    init_data = res_init.json()
    token = init_data["token"]
    created_at = init_data["created_at"]
    assert init_data["anonymized"] is True
    assert init_data["show_risks"] is False

    # PATCH only show_risks -> anonymized must stay True
    res_patch1 = client.patch(
        f"/api/teams/{team.id}/presentation-link",
        json={"show_risks": True},
        headers=headers,
    )
    assert res_patch1.status_code == 200
    patch1_data = res_patch1.json()
    assert patch1_data["token"] == token
    assert patch1_data["created_at"] == created_at
    assert patch1_data["show_risks"] is True
    assert patch1_data["anonymized"] is True  # preserved!

    # PATCH only anonymized -> show_risks must stay True
    res_patch2 = client.patch(
        f"/api/teams/{team.id}/presentation-link",
        json={"anonymized": False},
        headers=headers,
    )
    assert res_patch2.status_code == 200
    patch2_data = res_patch2.json()
    assert patch2_data["token"] == token
    assert patch2_data["created_at"] == created_at
    assert patch2_data["anonymized"] is False
    assert patch2_data["show_risks"] is True  # preserved!

    # PATCH empty object -> neither field changes
    res_patch3 = client.patch(
        f"/api/teams/{team.id}/presentation-link",
        json={},
        headers=headers,
    )
    assert res_patch3.status_code == 200
    patch3_data = res_patch3.json()
    assert patch3_data["token"] == token
    assert patch3_data["anonymized"] is False
    assert patch3_data["show_risks"] is True

    # Public endpoint reflects show_risks=True
    pub = client.get(f"/api/public/presentations/{token}")
    assert pub.status_code == 200
    pub_data = pub.json()
    assert pub_data["show_risks"] is True
    assert pub_data["anonymized"] is False


# 15. test_presentation_link_delete_resets_show_risks
def test_presentation_link_delete_resets_show_risks(client, db_session, sample_team_setup):
    """Deleting presentation link resets presentation_show_risks to False."""
    team = sample_team_setup["team"]
    manager = sample_team_setup["manager"]
    headers = _auth_header(manager)

    # Create link with show_risks=True
    res_post = client.post(
        f"/api/teams/{team.id}/presentation-link",
        json={"anonymized": True, "show_risks": True},
        headers=headers,
    )
    assert res_post.status_code == 200
    assert res_post.json()["show_risks"] is True

    # DELETE link
    res_del = client.delete(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_del.status_code == 204

    # Check GET presentation-link returns None
    res_get = client.get(f"/api/teams/{team.id}/presentation-link", headers=headers)
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert get_data["token"] is None
    assert get_data["show_risks"] is None

    # Verify directly in DB that presentation_show_risks was reset to False
    db_session.expire_all()
    from models import Team
    refreshed_team = db_session.query(Team).filter(Team.id == team.id).first()
    assert refreshed_team.presentation_show_risks is False
    assert refreshed_team.presentation_anonymized is False

