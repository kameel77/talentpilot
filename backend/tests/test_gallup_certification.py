"""Tests for Gallup certification fields on the User model / schemas / PATCH endpoint."""
import pytest
from pydantic import ValidationError

from models import Organization, User, UserRole
from schemas import UserUpdate
from auth import create_access_token, hash_password


# -------- Schema-level validation --------

def test_valid_gallup_url_accepted():
    data = UserUpdate(gallup_profile_url="https://www.gallup.com/cliftonstrengths/en/coach.aspx")
    assert data.gallup_profile_url == "https://www.gallup.com/cliftonstrengths/en/coach.aspx"


def test_gallup_subdomain_accepted():
    data = UserUpdate(gallup_profile_url="https://my.gallup.com/profile")
    assert data.gallup_profile_url == "https://my.gallup.com/profile"


def test_non_gallup_host_rejected():
    with pytest.raises(ValidationError) as exc_info:
        UserUpdate(gallup_profile_url="https://evil.com/gallup.com")
    assert "gallup.com" in str(exc_info.value)


def test_non_https_scheme_rejected():
    with pytest.raises(ValidationError) as exc_info:
        UserUpdate(gallup_profile_url="http://gallup.com/profile")
    assert "https://" in str(exc_info.value)


def test_empty_string_accepted():
    data = UserUpdate(gallup_profile_url="")
    assert data.gallup_profile_url is None


def test_none_accepted():
    data = UserUpdate(gallup_profile_url=None)
    assert data.gallup_profile_url is None


# -------- API round trip --------

@pytest.fixture
def coach_org(db_session):
    org = Organization(name="Coach Org")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def coach_user(db_session, coach_org):
    user = User(
        email="coach@example.com",
        hashed_password=hash_password("password123"),
        full_name="Coach User",
        role=UserRole.COACH,
        organization_id=coach_org.id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def coach_headers(coach_user):
    token = create_access_token({"sub": str(coach_user.id)})
    return {"Authorization": f"Bearer {token}"}


def test_gallup_certification_roundtrips_through_patch(client, coach_user, coach_headers):
    response = client.patch(
        f"/api/users/{coach_user.id}",
        json={
            "gallup_certified": True,
            "gallup_profile_url": "https://www.gallup.com/cliftonstrengths/en/coach.aspx",
        },
        headers=coach_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["gallup_certified"] is True
    assert data["gallup_profile_url"] == "https://www.gallup.com/cliftonstrengths/en/coach.aspx"

    # Confirm it persisted, not just echoed back
    get_response = client.get(f"/api/users/{coach_user.id}", headers=coach_headers)
    assert get_response.status_code == 200
    get_data = get_response.json()
    assert get_data["gallup_certified"] is True
    assert get_data["gallup_profile_url"] == "https://www.gallup.com/cliftonstrengths/en/coach.aspx"


def test_gallup_certification_defaults_false(client, coach_user, coach_headers):
    response = client.get(f"/api/users/{coach_user.id}", headers=coach_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["gallup_certified"] is False
    assert data["gallup_profile_url"] is None


def test_patch_rejects_non_gallup_url(client, coach_user, coach_headers):
    response = client.patch(
        f"/api/users/{coach_user.id}",
        json={"gallup_profile_url": "https://not-gallup.example.com/profile"},
        headers=coach_headers,
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "gallup.com" in str(detail)
