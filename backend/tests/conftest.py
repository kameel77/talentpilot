"""Pytest fixtures for TalentPilot backend tests."""
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")
# Billing (docs/BRIEF_BILLING_TRIAL.md §5-6, Phase 2): tests default to the
# fake provider so billing/dev_billing router tests can exercise the full
# checkout -> webhook -> state-machine flow without Stripe. This is safe as
# a suite-wide default — `environment` defaults to "development", so the
# production boot guard in config.py never trips here.
os.environ.setdefault("BILLING_PROVIDER", "fake")
os.environ.setdefault("BILLING_WEBHOOK_SECRET", "test-billing-webhook-secret")

from database import Base, get_db
from main import app
from external_app import external_app
from models import Organization, User, UserRole
from auth import create_access_token, hash_password


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a new database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database dependency override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    # Sub-apps have independent dependency registries — override separately.
    external_app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    external_app.dependency_overrides.clear()


@pytest.fixture
def test_organization(db_session):
    """Create a test organization."""
    org = Organization(name="Test Organization")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture
def test_user(db_session, test_organization):
    """Create a test user."""
    user = User(
        email="testuser@example.com",
        hashed_password=hash_password("testpassword123"),
        full_name="Test User",
        role=UserRole.USER,
        organization_id=test_organization.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_admin(db_session, test_organization):
    """Create a test admin user."""
    admin = User(
        email="admin@example.com",
        hashed_password=hash_password("adminpassword123"),
        full_name="Admin User",
        role=UserRole.ADMIN,
        organization_id=test_organization.id,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def auth_headers_user(test_user):
    """Get auth headers for test user."""
    token = create_access_token({"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_admin(test_admin):
    """Get auth headers for admin user."""
    token = create_access_token({"sub": str(test_admin.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_openrouter():
    """Mock OpenRouter API responses."""
    with patch("services.assistant_service.get_openrouter_client") as mock_client:
        # Mock embedding response
        mock_embedding_response = MagicMock()
        mock_embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        
        # Mock chat completion response
        mock_chat_response = MagicMock()
        mock_chat_response.choices = [
            MagicMock(message=MagicMock(content="Mocked AI response for testing."))
        ]
        
        # Configure the mock client
        mock_instance = MagicMock()
        mock_instance.embeddings.create.return_value = mock_embedding_response
        mock_instance.chat.completions.create.return_value = mock_chat_response
        mock_client.return_value = mock_instance
        
        yield mock_instance
