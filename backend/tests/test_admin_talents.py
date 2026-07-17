"""Tests for admin talent content management endpoints."""
import pytest

from models import Talent, TalentTranslation, GallupDomain


@pytest.fixture
def seeded_talents(db_session):
    """Create two talents with EN translations (and one PL name-only)."""
    achiever = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    strategic = Talent(code="strategic", domain=GallupDomain.STRATEGIC_THINKING)
    db_session.add_all([achiever, strategic])
    db_session.flush()
    db_session.add_all([
        TalentTranslation(
            talent_id=achiever.id, language="en", name="Achiever",
            short_description="Great stamina and work ethic",
            description="Full EN description.",
        ),
        TalentTranslation(talent_id=achiever.id, language="pl", name="Osiąganie"),
        TalentTranslation(
            talent_id=strategic.id, language="en", name="Strategic",
            short_description="Creates alternative ways to proceed",
            description="Full EN description.",
        ),
    ])
    db_session.commit()
    return {"achiever": achiever, "strategic": strategic}


class TestListAdminTalents:
    def test_requires_admin(self, client, auth_headers_user, seeded_talents):
        resp = client.get("/api/admin/talents", headers=auth_headers_user)
        assert resp.status_code == 403

    def test_lists_talents_with_all_translations(self, client, auth_headers_admin, seeded_talents):
        resp = client.get("/api/admin/talents", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        achiever = next(t for t in data if t["code"] == "achiever")
        assert achiever["domain"] == "executing"
        langs = {tr["language"] for tr in achiever["translations"]}
        assert langs == {"en", "pl"}
        en = next(tr for tr in achiever["translations"] if tr["language"] == "en")
        assert en["short_description"] == "Great stamina and work ethic"


class TestPatchTalentTranslation:
    def test_requires_admin(self, client, auth_headers_user, seeded_talents):
        resp = client.patch(
            f"/api/admin/talents/{seeded_talents['achiever'].id}/translations/pl",
            headers=auth_headers_user,
            json={"short_description": "x"},
        )
        assert resp.status_code == 403

    def test_partial_update(self, client, auth_headers_admin, seeded_talents, db_session):
        talent_id = seeded_talents["achiever"].id
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"short_description": "Ogromna wytrwałość"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["language"] == "pl"
        assert body["name"] == "Osiąganie"  # untouched
        assert body["short_description"] == "Ogromna wytrwałość"

    def test_update_name_and_description(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["achiever"].id
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/en",
            headers=auth_headers_admin,
            json={"name": "Achiever!", "description": "New full description."},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Achiever!"
        assert resp.json()["description"] == "New full description."

    def test_creates_missing_translation_row(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["strategic"].id  # has no PL row
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"name": "Strateg", "short_description": "Dostrzega wzorce"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Strateg"

    def test_creating_translation_without_name_fails(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["strategic"].id  # has no PL row
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"short_description": "bez nazwy"},
        )
        assert resp.status_code == 422

    def test_unknown_talent_404(self, client, auth_headers_admin, seeded_talents):
        resp = client.patch(
            "/api/admin/talents/99999/translations/pl",
            headers=auth_headers_admin,
            json={"name": "X"},
        )
        assert resp.status_code == 404
