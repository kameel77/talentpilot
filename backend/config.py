"""Application configuration using Pydantic Settings."""
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

_ALLOWED_BILLING_PROVIDERS = {"disabled", "fake", "stripe"}


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440  # 24 hours
    
    # OpenAI (legacy)
    openai_api_key: str

    # OpenRouter (optional - for AI assistant functionality)
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    
    # Integration
    talentpilot_team_url: str | None = None
    external_api_key: str | None = None
    
    # Application
    environment: str = "development"
    debug: bool = True
    cors_origins: str = "http://localhost:3000"
    frontend_url: str = "http://localhost:3000"
    
    # Email / SMTP
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Manager Copilot"
    
    # Redis (optional)
    redis_url: str | None = None

    # Billing (docs/BRIEF_BILLING_TRIAL.md §5-6). "disabled" is the valid,
    # supported state in production today — there is no billing infra live
    # yet. See the boot guard below for what's NOT allowed.
    billing_provider: str = "disabled"
    billing_webhook_secret: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @field_validator("cors_origins")
    @classmethod
    def _validate_cors_origins(cls, raw: str) -> str:
        cleaned = raw.strip().strip('"').strip("'")
        if not cleaned:
            raise ValueError("CORS_ORIGINS must not be empty")
        origins = [o.strip().rstrip("/") for o in cleaned.split(",") if o.strip()]
        for origin in origins:
            if not (origin.startswith("http://") or origin.startswith("https://")):
                raise ValueError(
                    f"CORS_ORIGINS entry '{origin}' must start with http:// or https://"
                )
        return cleaned

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list."""
        clean_origins = self.cors_origins.strip().strip('"').strip("'")
        return [origin.strip().rstrip("/") for origin in clean_origins.split(",") if origin.strip()]

    @field_validator("billing_provider")
    @classmethod
    def _validate_billing_provider_value(cls, raw: str) -> str:
        cleaned = (raw or "").strip().lower()
        if cleaned not in _ALLOWED_BILLING_PROVIDERS:
            raise ValueError(
                f"BILLING_PROVIDER must be one of {sorted(_ALLOWED_BILLING_PROVIDERS)}, got {raw!r}"
            )
        return cleaned

    @model_validator(mode="after")
    def _billing_provider_boot_guard(self) -> "Settings":
        """Billing provider boot guard (docs/BRIEF_BILLING_TRIAL.md §5-6).

        A `model_validator`, not a FastAPI `@app.on_event("startup")` hook:
        this file already has a `field_validator` for `cors_origins`
        following the same pattern, and — more importantly — it runs on
        every `Settings()` construction, which happens once at import time
        via the module-level `settings = Settings()` below. That means
        every entry point that ever imports `config` (uvicorn via
        `main.py`, pytest via `tests/conftest.py`, one-off scripts under
        `backend/scripts/`) gets this guard for free. A startup hook would
        only fire for the uvicorn process and silently skip scripts.

        Two — and only two — configurations are refused:

        1. `environment="production"` and `billing_provider="fake"`.
           `"disabled"` remains a fully valid production value (today's
           live deploy runs with no billing at all) — this guard is
           deliberately narrower than "prod must be stripe". Silently
           running fake billing in production would give every customer
           Pro for free with no signal until month-end reconciliation, so
           this raises instead of logging a warning.
        2. `billing_provider="stripe"`, in any environment. The Stripe
           adapter doesn't exist yet in this phase (only `base.py` and
           `fake_provider.py` do) — this fails loud at boot instead of
           starting into a provider that can't actually call anything.
        """
        if self.environment == "production" and self.billing_provider == "fake":
            raise RuntimeError(
                "billing_provider='fake' is not allowed when environment='production'. "
                "Use 'disabled' (no billing yet) or wait for the Stripe adapter."
            )
        if self.billing_provider == "stripe":
            raise NotImplementedError(
                "billing_provider='stripe' is not implemented yet. The Stripe adapter "
                "(backend/services/billing/stripe_provider.py) lands in the next phase — "
                "see docs/BRIEF_BILLING_TRIAL.md §6. Use 'fake' for dev/staging/CI or "
                "'disabled' for production today."
            )
        return self


# Global settings instance
settings = Settings()
