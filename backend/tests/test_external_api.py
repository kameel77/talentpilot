import pytest
from unittest.mock import patch
from models import Talent, TalentTranslation, GallupDomain, ApiKey

PARSE_URL = "/api/external/v1/gallup/parse"
PDF_CONTENT = b"%PDF-1.4 test content"


@pytest.fixture
def seed_talents_for_external(db_session):
    """Seed talents for testing external API."""
    achiever = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    db_session.add(achiever)
    db_session.flush()

    db_session.add(TalentTranslation(talent_id=achiever.id, language="en", name="Achiever"))
    db_session.add(TalentTranslation(talent_id=achiever.id, language="pl", name="Osiąganie"))

    db_session.commit()
    return achiever


@pytest.fixture
def api_key(db_session):
    """Create a valid API key for testing."""
    key = ApiKey(key="test_api_key_123", name="Test App", is_active=True)
    db_session.add(key)
    db_session.commit()
    return key


def test_parse_gallup_external_unauthorized(client):
    response = client.post(PARSE_URL, files={"file": ("test.pdf", b"pdf content", "application/pdf")})
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing API Key"


def test_parse_gallup_external_invalid_key(client):
    response = client.post(
        PARSE_URL,
        files={"file": ("test.pdf", b"pdf content", "application/pdf")},
        headers={"X-API-Key": "invalid_key"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid or inactive API Key"


def test_parse_gallup_external_invalid_file(client, api_key):
    response = client.post(
        PARSE_URL,
        files={"file": ("test.txt", b"txt content", "text/plain")},
        headers={"X-API-Key": api_key.key},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


from services.gallup_pdf_parser import GallupPersonInfo

@patch("routers.external.extract_gallup_rankings")
def test_parse_gallup_external_default_both_languages(mock_extract, client, api_key, seed_talents_for_external):
    """Default (pl+en): both language fields populated, domain object with number and both names."""
    mock_extract.return_value = ({"achiever": 1}, 5, GallupPersonInfo())

    response = client.post(
        PARSE_URL,
        files={"file": ("test.pdf", PDF_CONTENT, "application/pdf")},
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "pl+en"
    assert len(data["talents"]) == 1

    t = data["talents"][0]
    assert t["rank"] == 1
    assert t["talent"] == "achiever"
    assert t["domain"]["number"] == 1
    assert t["domain"]["pl"] == "Realizowanie"
    assert t["domain"]["en"] == "Executing"
    assert t["name"]["pl"] == "Osiąganie"
    assert t["name"]["en"] == "Achiever"


@patch("routers.external.extract_gallup_rankings")
def test_parse_gallup_external_language_pl(mock_extract, client, api_key, seed_talents_for_external):
    """language=pl: only Polish names returned, English fields are null."""
    mock_extract.return_value = ({"achiever": 1}, 5, GallupPersonInfo())

    response = client.post(
        PARSE_URL,
        params={"language": "pl"},
        files={"file": ("test.pdf", PDF_CONTENT, "application/pdf")},
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "pl"

    t = data["talents"][0]
    assert t["name"]["pl"] == "Osiąganie"
    assert t["name"]["en"] is None
    assert t["domain"]["pl"] == "Realizowanie"
    assert t["domain"]["en"] is None
    assert t["domain"]["number"] == 1


@patch("routers.external.extract_gallup_rankings")
def test_parse_gallup_external_language_en(mock_extract, client, api_key, seed_talents_for_external):
    """language=en: only English names returned, Polish fields are null."""
    mock_extract.return_value = ({"achiever": 1}, 5, GallupPersonInfo())

    response = client.post(
        PARSE_URL,
        params={"language": "en"},
        files={"file": ("test.pdf", PDF_CONTENT, "application/pdf")},
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "en"

    t = data["talents"][0]
    assert t["name"]["en"] == "Achiever"
    assert t["name"]["pl"] is None
    assert t["domain"]["en"] == "Executing"
    assert t["domain"]["pl"] is None
    assert t["domain"]["number"] == 1


@patch("routers.external.extract_gallup_rankings")
def test_parse_gallup_external_no_results(mock_extract, client, api_key):
    mock_extract.return_value = ({}, None, GallupPersonInfo())

    response = client.post(
        PARSE_URL,
        files={"file": ("test.pdf", PDF_CONTENT, "application/pdf")},
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["talents"] == []
    assert data["language"] == "pl+en"


from schemas import ExternalProvisionOrgTeamRequest
from models import Organization

def test_provision_org_team_blocks_workspace_org(db_session, client, api_key):
    """Provisioning a team into a private workspace org must return 400."""
    # Create a workspace organization (is_workspace=True)
    workspace_org = Organization(name="Workspace Org", is_workspace=True)
    db_session.add(workspace_org)
    db_session.commit()

    # Attempt to provision a team into the workspace org
    payload = ExternalProvisionOrgTeamRequest(
        org_id=workspace_org.id,
        org_name="Dummy Name",
        team_id=None,
        team_name="Test Team",
    )

    response = client.post(
        "/api/external/v1/provision/org-team",
        json=payload.model_dump(),
        headers={"X-API-Key": api_key.key},
    )

    assert response.status_code == 400
    assert "Cannot create teams in a private workspace" in response.json()["detail"]
