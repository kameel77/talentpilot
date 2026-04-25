import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO
from models import Talent, TalentTranslation, GallupDomain

@pytest.fixture
def seed_talents(db_session):
    """Seed talents for testing."""
    achiever = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    db_session.add(achiever)
    db_session.flush()
    
    db_session.add(TalentTranslation(talent_id=achiever.id, language="en", name="Achiever"))
    db_session.add(TalentTranslation(talent_id=achiever.id, language="pl", name="Osiąganie"))
    
    db_session.commit()
    return achiever

def test_parse_pdf_unauthorized(client):
    response = client.post("/api/gallup/parse-pdf", files={"file": ("test.pdf", b"pdf content", "application/pdf")})
    assert response.status_code == 401

def test_parse_pdf_invalid_file(client, auth_headers_user):
    response = client.post(
        "/api/gallup/parse-pdf", 
        files={"file": ("test.txt", b"txt content", "text/plain")},
        headers=auth_headers_user
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]

from services.gallup_pdf_parser import GallupPersonInfo

@patch("routers.gallup.extract_gallup_rankings")
def test_parse_pdf_success(mock_extract, client, auth_headers_user, seed_talents):
    # Mock return value: {code: rank}, page_index, person_info
    mock_extract.return_value = ({"achiever": 1}, 5, GallupPersonInfo())
    
    pdf_content = b"%PDF-1.4 test content"
    response = client.post(
        "/api/gallup/parse-pdf?language=pl",
        files={"file": ("test.pdf", pdf_content, "application/pdf")},
        headers=auth_headers_user
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["page_index"] == 5
    assert data["rankings"]["achiever"] == 1
    assert data["translated_rankings"]["Osiąganie"] == 1
    assert data["language"] == "pl"

@patch("routers.gallup.extract_gallup_rankings")
def test_parse_pdf_no_results(mock_extract, client, auth_headers_user):
    mock_extract.return_value = ({}, None, GallupPersonInfo())
    
    pdf_content = b"%PDF-1.4 test content"
    response = client.post(
        "/api/gallup/parse-pdf",
        files={"file": ("test.pdf", pdf_content, "application/pdf")},
        headers=auth_headers_user
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["page_index"] is None
    assert data["rankings"] == {}
    assert data["translated_rankings"] == {}
