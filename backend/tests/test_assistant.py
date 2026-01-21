"""Tests for Assistant and Admin API endpoints."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from models import (
    KnowledgeItem,
    UserQuery,
    GeneratedAnswer,
    AnswerReview,
    ReviewStatus,
    AppSetting,
    Talent,
    TalentTranslation,
    UserTalent,
    GallupDomain,
    Organization,
    User,
    UserRole,
)
from auth import hash_password, create_access_token


# ============== Assistant Endpoint Tests ==============


class TestAssistantQuery:
    """Tests for POST /api/assistant/query endpoint."""

    def test_query_unauthorized(self, client):
        """Test that unauthenticated requests are rejected."""
        response = client.post(
            "/api/assistant/query",
            json={"question": "How to motivate someone with Achiever talent?"},
        )
        # FastAPI returns 403 for missing auth, 401 for invalid token
        assert response.status_code in [401, 403]

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector extension")
    def test_query_success(self, client, auth_headers_user, mock_openrouter, db_session, test_user):
        """Test successful query with mocked OpenRouter."""
        response = client.post(
            "/api/assistant/query",
            json={"question": "How to motivate someone with Achiever talent?"},
            headers=auth_headers_user,
        )
        assert response.status_code == 200
        data = response.json()
        assert "query_id" in data
        assert "answer_id" in data
        assert "answer_text" in data
        assert "model_name" in data

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector extension")
    def test_query_rate_limit(self, client, auth_headers_user, mock_openrouter, db_session, test_user):
        """Test that rate limiting is enforced."""
        # Set a low limit
        setting = AppSetting(key="daily_query_limit", value="2")
        db_session.add(setting)
        db_session.commit()

        # First query should succeed
        response1 = client.post(
            "/api/assistant/query",
            json={"question": "Question 1?"},
            headers=auth_headers_user,
        )
        assert response1.status_code == 200

        # Second query should succeed
        response2 = client.post(
            "/api/assistant/query",
            json={"question": "Question 2?"},
            headers=auth_headers_user,
        )
        assert response2.status_code == 200

        # Third query should be rate limited
        response3 = client.post(
            "/api/assistant/query",
            json={"question": "Question 3?"},
            headers=auth_headers_user,
        )
        assert response3.status_code == 429
        assert "limit" in response3.json()["detail"].lower()

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector extension")
    def test_query_hash_deduplication(self, client, auth_headers_user, mock_openrouter, db_session, test_user):
        """Test that identical questions return cached responses."""
        question = "How does the Achiever talent work?"

        # First query
        response1 = client.post(
            "/api/assistant/query",
            json={"question": question},
            headers=auth_headers_user,
        )
        assert response1.status_code == 200
        query_id_1 = response1.json()["query_id"]

        # Same question again - should return same answer
        response2 = client.post(
            "/api/assistant/query",
            json={"question": question},
            headers=auth_headers_user,
        )
        assert response2.status_code == 200
        # Answer should be the same (cached)
        assert response2.json()["answer_id"] == response1.json()["answer_id"]

    def test_query_target_user_not_found(self, client, auth_headers_user, mock_openrouter, db_session):
        """Test query for non-existent target user."""
        response = client.post(
            "/api/assistant/query",
            json={"question": "How to motivate user?", "target_user_id": 99999},
            headers=auth_headers_user,
        )
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]


class TestAssistantOpenRouterError:
    """Tests for OpenRouter API error handling."""

    def test_query_openrouter_unavailable(self, client, auth_headers_user, db_session):
        """Test graceful handling of OpenRouter API failure."""
        from openai import OpenAIError

        with patch("services.assistant_service.get_openrouter_client") as mock_client:
            mock_instance = MagicMock()
            mock_instance.embeddings.create.side_effect = OpenAIError("API unavailable")
            mock_client.return_value = mock_instance

            response = client.post(
                "/api/assistant/query",
                json={"question": "Test question?"},
                headers=auth_headers_user,
            )
            assert response.status_code == 503
            assert "niedostępna" in response.json()["detail"].lower()


# ============== Admin Endpoint Tests ==============


class TestAdminQueries:
    """Tests for GET /api/admin/queries endpoint."""

    def test_list_queries_unauthorized(self, client, auth_headers_user):
        """Test that non-admin users can't access admin endpoints."""
        response = client.get("/api/admin/queries", headers=auth_headers_user)
        assert response.status_code == 403

    def test_list_queries_admin_success(self, client, auth_headers_admin, db_session, test_admin, test_organization, mock_openrouter):
        """Test that admin can list pending queries."""
        # Create a query with pending review
        user_query = UserQuery(
            user_id=test_admin.id,
            target_user_id=test_admin.id,
            organization_id=test_organization.id,
            question="Test question?",
            question_hash="testhash123",
            embedding=[0.1] * 1536,
            language="pl",
            is_unique=True,
        )
        db_session.add(user_query)
        db_session.flush()

        answer = GeneratedAnswer(
            query_id=user_query.id,
            answer_text="Test answer",
            model_name="test-model",
            sources=[],
        )
        db_session.add(answer)
        db_session.flush()

        review = AnswerReview(
            generated_answer_id=answer.id,
            status=ReviewStatus.PENDING,
        )
        db_session.add(review)
        db_session.commit()

        response = client.get("/api/admin/queries", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["question"] == "Test question?"
        assert data[0]["status"] == "pending"


class TestAdminReviewAnswer:
    """Tests for PATCH /api/admin/answers/{answer_id} endpoint."""

    def test_review_answer_approve(self, client, auth_headers_admin, db_session, test_admin, test_organization, mock_openrouter):
        """Test approving an answer creates knowledge item."""
        # Create query and answer
        user_query = UserQuery(
            user_id=test_admin.id,
            target_user_id=test_admin.id,
            organization_id=test_organization.id,
            question="Test question?",
            question_hash="hash123",
            embedding=[0.1] * 1536,
            language="pl",
            is_unique=True,
        )
        db_session.add(user_query)
        db_session.flush()

        answer = GeneratedAnswer(
            query_id=user_query.id,
            answer_text="Original answer",
            model_name="test-model",
            sources=[],
        )
        db_session.add(answer)
        db_session.flush()

        review = AnswerReview(
            generated_answer_id=answer.id,
            status=ReviewStatus.PENDING,
        )
        db_session.add(review)
        db_session.commit()

        # Approve with edited text
        response = client.patch(
            f"/api/admin/answers/{answer.id}",
            json={"status": "approved", "edited_text": "Improved answer"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

        # Verify knowledge item was created
        knowledge = db_session.query(KnowledgeItem).filter(
            KnowledgeItem.source_query_id == user_query.id
        ).first()
        assert knowledge is not None
        assert knowledge.title == "Test question?"
        assert knowledge.section == "faq"
        assert knowledge.category == "FAQ"
        assert knowledge.content == "Improved answer"

    def test_review_answer_tenant_isolation(self, client, db_session, test_admin, test_organization, auth_headers_admin):
        """Test that admin cannot review answers from other organizations."""
        # Create another organization
        other_org = Organization(name="Other Org")
        db_session.add(other_org)
        db_session.flush()

        other_user = User(
            email="other@example.com",
            hashed_password=hash_password("password123"),
            full_name="Other User",
            role=UserRole.USER,
            organization_id=other_org.id,
        )
        db_session.add(other_user)
        db_session.flush()

        # Create query in OTHER organization
        other_query = UserQuery(
            user_id=other_user.id,
            target_user_id=other_user.id,
            organization_id=other_org.id,  # Different org!
            question="Other org question?",
            question_hash="otherhash",
            embedding=[0.1] * 1536,
            language="pl",
            is_unique=True,
        )
        db_session.add(other_query)
        db_session.flush()

        other_answer = GeneratedAnswer(
            query_id=other_query.id,
            answer_text="Other answer",
            model_name="test-model",
            sources=[],
        )
        db_session.add(other_answer)
        db_session.commit()

        # Try to review answer from other org - should fail with 404
        response = client.patch(
            f"/api/admin/answers/{other_answer.id}",
            json={"status": "approved"},
            headers=auth_headers_admin,
        )
        assert response.status_code == 404


class TestAdminKnowledge:
    """Tests for POST /api/admin/knowledge endpoint."""

    def test_create_knowledge_success(self, client, auth_headers_admin, mock_openrouter, db_session):
        """Test creating a new knowledge item."""
        response = client.post(
            "/api/admin/knowledge",
            json={
                "title": "Jak wspierać zaangażowanie?",
                "category": "Motywacja",
                "tags": ["zaangażowanie", "feedback"],
                "section": "merytoryka",
                "content": "Test knowledge content about talent management.",
                "language": "pl",
                "metadata_json": {"category": "motivation"},
            },
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Jak wspierać zaangażowanie?"
        assert data["category"] == "Motywacja"
        assert data["tags"] == ["zaangażowanie", "feedback"]
        assert data["section"] == "merytoryka"
        assert data["content"] == "Test knowledge content about talent management."
        assert data["language"] == "pl"
        assert data["is_active"] is True


class TestAdminSettings:
    """Tests for admin settings endpoints."""

    def test_get_settings(self, client, auth_headers_admin, db_session):
        """Test getting all settings."""
        response = client.get("/api/admin/settings", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "settings" in data
        # Check default settings are present
        assert "openrouter_chat_model" in data["settings"]
        assert "daily_query_limit" in data["settings"]
        assert "system_prompt" in data["settings"]

    def test_update_settings(self, client, auth_headers_admin, db_session):
        """Test updating settings."""
        response = client.patch(
            "/api/admin/settings",
            json=[
                {"key": "daily_query_limit", "value": "50"},
                {"key": "system_prompt", "value": "Custom prompt for testing."},
            ],
            headers=auth_headers_admin,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["settings"]["daily_query_limit"] == "50"
        assert data["settings"]["system_prompt"] == "Custom prompt for testing."
