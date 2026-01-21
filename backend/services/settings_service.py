"""Service helpers for app settings."""
from sqlalchemy.orm import Session

from models import AppSetting


DEFAULT_SETTINGS = {
    "openrouter_chat_model": "openai/gpt-4o-mini",
    "openrouter_embedding_model": "text-embedding-3-small",
    "daily_query_limit": "20",
}


def get_setting(db: Session, key: str) -> str:
    """Return a setting value or fallback to defaults."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if setting:
        return setting.value
    return DEFAULT_SETTINGS.get(key, "")


def get_all_settings(db: Session) -> dict[str, str]:
    """Return a dict of all settings, seeded with defaults."""
    stored = {item.key: item.value for item in db.query(AppSetting).all()}
    settings = DEFAULT_SETTINGS.copy()
    settings.update(stored)
    return settings


def upsert_setting(db: Session, key: str, value: str, updated_by: int | None) -> AppSetting:
    """Create or update a setting."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if setting:
        setting.value = value
        setting.updated_by = updated_by
        return setting
    setting = AppSetting(key=key, value=value, updated_by=updated_by)
    db.add(setting)
    return setting
