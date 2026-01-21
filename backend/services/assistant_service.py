"""Assistant service for embeddings, retrieval, and prompt building."""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Iterable

from fastapi import HTTPException, status
from openai import OpenAI, OpenAIError
from sqlalchemy.orm import Session

from config import settings
from models import KnowledgeItem, Talent, TalentTranslation, User, UserQuery, UserTalent
from services.settings_service import get_setting


logger = logging.getLogger(__name__)

DEFAULT_LANGUAGE = "pl"
TOP_K_SOURCES = 5


def get_openrouter_client() -> OpenAI:
    """Initialize OpenRouter client via OpenAI SDK.
    
    Raises:
        HTTPException: If OpenRouter API key is not configured.
    """
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant is not configured. Please set OPENROUTER_API_KEY in environment."
        )
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


def get_user_talents(db: Session, user_id: int, language: str) -> list[dict]:
    """Return ordered talent info for a user in a given language."""
    talents = (
        db.query(UserTalent, TalentTranslation, Talent)
        .join(TalentTranslation, UserTalent.talent_id == TalentTranslation.talent_id)
        .join(Talent, UserTalent.talent_id == Talent.id)
        .filter(UserTalent.user_id == user_id, TalentTranslation.language == language)
        .order_by(UserTalent.rank.asc())
        .all()
    )
    if not talents:
        return []
    return [
        {
            "name": trans.name,
            "rank": ut.rank,
            "domain": t.domain.value if hasattr(t.domain, "value") else str(t.domain)
        }
        for ut, trans, t in talents
    ]


def get_embedding(db: Session, text: str) -> list[float]:
    """Generate embedding for the given text using OpenRouter.
    
    Raises:
        HTTPException: If embedding generation fails.
    """
    try:
        client = get_openrouter_client()
        embedding_model = get_setting(db, "openrouter_embedding_model")
        response = client.embeddings.create(
            model=embedding_model,
            input=text,
        )
        return response.data[0].embedding
    except OpenAIError as e:
        logger.error(f"OpenRouter embedding error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Usługa generowania embeddingów jest chwilowo niedostępna. Spróbuj ponownie za chwilę."
        )


def retrieve_knowledge(
    db: Session,
    organization_id: int,
    embedding: list[float],
    language: str,
    top_k: int = TOP_K_SOURCES,
) -> list[KnowledgeItem]:
    """Retrieve curated knowledge items using vector similarity.
    
    Returns both global knowledge (organization_id=null) and org-specific knowledge.
    Global knowledge contains general talent management advice.
    Org-specific knowledge contains cultural/team-specific context added by org admins.
    """
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


DOMAIN_LABELS = {
    "executing": "Realizacja (Executing)",
    "influencing": "Wywieranie wpływu (Influencing)",
    "relationship_building": "Budowanie relacji (Relationship Building)",
    "strategic_thinking": "Myślenie strategiczne (Strategic Thinking)",
}


def build_prompt(
    db: Session,
    question: str,
    talents: Iterable[dict],
    knowledge_items: Iterable[KnowledgeItem],
    language: str,
) -> list[dict]:
    """Build chat prompt messages for LLM using configurable system prompt."""
    if talents:
        talents_lines = []
        for t in talents:
            domain_label = DOMAIN_LABELS.get(t["domain"], t["domain"])
            line = f"Rank {t['rank']}: {t['name']} (Domena: {domain_label})"
            if t["rank"] <= 5:
                line = f"[TOP 5] {line}"
            talents_lines.append(line)
        talents_section = "\n".join(talents_lines)
    else:
        talents_section = "Brak danych o talentach."

    knowledge_section = "\n".join(f"- {item.content}" for item in knowledge_items) or "Brak dodatkowej wiedzy."

    # Get configurable system prompt from settings (editable by admin)
    system_prompt_base = get_setting(db, "system_prompt")
    system_message = f"{system_prompt_base} Odpowiedzi udzielaj w języku: {language}."

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


def generate_answer(
    db: Session,
    question: str,
    talents: Iterable[dict],
    knowledge_items: Iterable[KnowledgeItem],
    language: str,
) -> tuple[str, str]:
    """Generate answer using LLM.
    
    Raises:
        HTTPException: If LLM API call fails.
    """
    try:
        client = get_openrouter_client()
        model_name = get_setting(db, "openrouter_chat_model")
        messages = build_prompt(db, question, talents, knowledge_items, language)
        
        # DEBUG: Log the prompt for developers
        import json
        logger.info(f"--- LLM REQUEST (Model: {model_name}) ---\n" + json.dumps(messages, indent=2, ensure_ascii=False))

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.4,
        )
        answer_text = response.choices[0].message.content.strip()
        return answer_text, model_name
    except OpenAIError as e:
        logger.error(f"OpenRouter chat completion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę."
        )


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


def get_user_in_organization(db: Session, user_id: int, organization_id: int) -> User | None:
    """Fetch a user belonging to the specified organization.
    
    Returns None if user doesn't exist or belongs to a different organization.
    """
    return (
        db.query(User)
        .filter(User.id == user_id, User.organization_id == organization_id)
        .first()
    )
