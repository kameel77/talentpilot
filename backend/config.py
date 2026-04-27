"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


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
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list."""
        return [origin.strip().strip('"').strip("'") for origin in self.cors_origins.split(",")]


# Global settings instance
settings = Settings()
