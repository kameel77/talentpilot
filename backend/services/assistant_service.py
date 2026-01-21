"""Assistant service for embeddings, retrieval, and prompt building."""
from __future__ import annotations

import hashlib
import re
from typing import Iterable

from openai import OpenAI
from sqlalchemy.orm import Session

from config import settings
from models import KnowledgeItem, TalentTranslation, User, UserQuery, UserTalent
from services.settings_service import get_setting


DEFAULT_LANGUAGE = "pl"
TOP_K_SOURCES = 5


def get_openrouter_client() -> OpenAI:
    """Initialize OpenRouter client via OpenAI SDK."""
    return OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )


def normalize_question(question: str) -> str:
    """Normalize question text for hashing."""
    normalized = question.strip().lower()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def compute_question_hash(question: str) -> str:
    """Compute a deterministic hash for exact-match detection."""
    normalized = normalize_question(question)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_user_talents(db: Session, user_id: int, language: str) -> list[str]:
    """Return ordered talent names for a user in a given language."""
    talents = (
        db.query(UserTalent, TalentTranslation)
        .join(TalentTranslation, UserTalent.talent_id == TalentTranslation.talent_id)
        .filter(UserTalent.user_id == user_id, TalentTranslation.language == language)
        .order_by(UserTalent.rank.asc())
        .all()
    )
    if not talents:
        return []
    return [translation.name for _, translation in talents]


def get_embedding(db: Session, text: str) -> list[float]:
    """Generate embedding for the given text using OpenRouter."""
    client = get_openrouter_client()
    embedding_model = get_setting(db, "openrouter_embedding_model")
    response = client.embeddings.create(
        model=embedding_model,
        input=text,
    )
    return response.data[0].embedding


def retrieve_knowledge(
    db: Session,
    organization_id: int,
    embedding: list[float],
    language: str,
    top_k: int = TOP_K_SOURCES,
) -> list[KnowledgeItem]:
    """Retrieve curated knowledge items using vector similarity."""
    return (
        db.query(KnowledgeItem)
        .filter(
            KnowledgeItem.is_active.is_(True),
            KnowledgeItem.language == language,
            (KnowledgeItem.organization_id.is_(None) | (KnowledgeItem.organization_id == organization_id)),
        )
        .order_by(KnowledgeItem.embedding.cosine_distance(embedding))
        .limit(top_k)
        .all()
    )


def build_prompt(question: str, talents: Iterable[str], knowledge_items: Iterable[KnowledgeItem], language: str) -> list[dict]:
    """Build chat prompt messages for LLM."""
    talents_section = ", ".join(talents) if talents else "Brak danych o talentach."
    knowledge_section = "\n".join(f"- {item.content}" for item in knowledge_items) or "Brak dodatkowej wiedzy."

    system_message = (
        "Jesteś profesjonalnym doradcą managerskim w aplikacji TalentPilot. "
        "Twoim celem jest przetłumaczenie talentów na praktyczne kompetencje i działania. "
        "Odpowiadaj z empatią, konkretnie i bez ogólników. "
        f"Odpowiedzi udzielaj w języku: {language}."
    )

    user_message = (
        "Kontekst talentów:\n"
        f"{talents_section}\n\n"
        "Kontekst wiedzy kuratorowanej:\n"
        f"{knowledge_section}\n\n"
        "Pytanie użytkownika:\n"
        f"{question}"
    )

    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]


def generate_answer(db: Session, question: str, talents: Iterable[str], knowledge_items: Iterable[KnowledgeItem], language: str) -> tuple[str, str]:
    """Generate answer using LLM."""
    client = get_openrouter_client()
    model_name = get_setting(db, "openrouter_chat_model")
    messages = build_prompt(question, talents, knowledge_items, language)
    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=0.4,
    )
    answer_text = response.choices[0].message.content.strip()
    return answer_text, model_name


def find_similar_query(
    db: Session,
    organization_id: int,
    embedding: list[float],
    language: str,
    threshold: float = 0.9,
) -> UserQuery | None:
    """Find a semantically similar query based on cosine similarity."""
    max_distance = 1 - threshold
    return (
        db.query(UserQuery)
        .filter(
            UserQuery.organization_id == organization_id,
            UserQuery.language == language,
            UserQuery.embedding.cosine_distance(embedding) <= max_distance,
        )
        .order_by(UserQuery.embedding.cosine_distance(embedding))
        .first()
    )


def get_user_or_404(db: Session, user_id: int, organization_id: int) -> User:
    """Fetch a user with organization check."""
    return (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == organization_id)
        .first()
    )
