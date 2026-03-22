import logging
from sqlalchemy.orm import Session

from models import AppSetting

logger = logging.getLogger(__name__)


DEFAULT_SETTINGS = {
    "openrouter_chat_model": "openai/gpt-4o-mini",
    "openrouter_embedding_model": "text-embedding-3-small",
    "daily_query_limit": "20",
    "rag_top_k": "8",
    # System prompt - editable by admin in UI
    "system_prompt": (
        "Jesteś profesjonalnym doradcą managerskim w aplikacji TalentPilot. "
        "Twoim celem jest przetłumaczenie talentów na praktyczne kompetencje i działania. "
        "Odpowiadaj z empatią, konkretnie i bez ogólników.\n\n"
        "BARDZO WAŻNE: Twoja odpowiedź MUSI ściśle przestrzegać poniższego formatu:\n"
        "Talent: [Nazwa Talentu]\n"
        "Kompetencja: [Nazwa Kompetencji Biznesowej]\n"
        "Akcja: \n"
        "1) [Pierwszy konkretny krok]\n"
        "2) [Drugi konkretny krok]\n"
        "3) [Trzeci konkretny krok]\n"
    ),
}


def get_setting(db: Session, key: str) -> str:
    """Return a setting value or fallback to defaults."""
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if setting:
        logger.info(f"Setting '{key}' loaded from DATABASE")
        return setting.value
    logger.info(f"Setting '{key}' loaded from CODE DEFAULTS")
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
