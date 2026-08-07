"""Tests for GET /api/organizations."""


def _register_coach(client, email="coach@example.com", full_name="Anna Kowalska"):
    """Helper: register a coach via self-serve endpoint, return auth headers."""
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_list_organizations_excludes_coach_workspace(client, db_session):
    """A coach's own (is_workspace=True) org must not appear in the list,
    but client orgs they have OrganizationAccess to must."""
    headers = _register_coach(client)

    # Creating an org as a coach auto-grants OrganizationAccess to it.
    client_org = client.post(
        "/api/organizations", json={"name": "Acme Client"}, headers=headers
    ).json()

    response = client.get("/api/organizations", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    org_names = [org["name"] for org in data]
    assert "Acme Client" in org_names
    assert all(not org["is_workspace"] for org in data)
    assert client_org["id"] in [org["id"] for org in data]
