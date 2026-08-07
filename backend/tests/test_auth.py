"""Tests for auth router and registration workspace logic."""
import pytest
from models import User, Organization, UserRole


def test_register_creates_personal_workspace(client, db_session):
    """Test POST /api/auth/register without organization_name creates personal workspace."""
    payload = {
        "email": "personal_user@example.com",
        "password": "password123",
        "full_name": "Anna Kowalska",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data

    user = db_session.query(User).filter(User.email == "personal_user@example.com").first()
    assert user is not None
    assert user.role == UserRole.ADMIN

    org = db_session.query(Organization).filter(Organization.id == user.organization_id).first()
    assert org is not None
    assert org.name == "Anna Kowalska — Moje konto"
    assert org.is_workspace is True
    assert org.name_confirmed is False


def test_register_with_supplied_organization_name(client, db_session):
    """Test POST /api/auth/register with organization_name creates normal organization."""
    payload = {
        "email": "corp_admin@example.com",
        "password": "password123",
        "full_name": "Piotr Nowak",
        "organization_name": "Acme Sp. z o.o.",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data

    user = db_session.query(User).filter(User.email == "corp_admin@example.com").first()
    assert user is not None
    assert user.role == UserRole.ADMIN

    org = db_session.query(Organization).filter(Organization.id == user.organization_id).first()
    assert org is not None
    assert org.name == "Acme Sp. z o.o."
    assert org.is_workspace is False
    assert org.name_confirmed is True
