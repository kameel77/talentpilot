"""Intent classification service for Q&A pipeline.

Classifies user questions into intent classes using a lightweight LLM call.
Intent classes are dynamically sourced from KB entries in the 'instructions' section.
"""
from __future__ import annotations

import logging
from typing import Sequence

from openai import OpenAIError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import KnowledgeItem
from services.settings_service import get_setting

logger = logging.getLogger(__name__)

DEFAULT_INTENT = "default"


def get_available_intents(db: Session, language: str) -> list[dict]:
    """Fetch available intent classes from KB instructions section.
    
    Returns list of dicts with 'category' (intent key) and 'title' (human label).
    Intent classes are derived from unique category values of instruction entries.
    """
    instructions = (
        db.query(KnowledgeItem.category, KnowledgeItem.title)
        .filter(
            or_(
                KnowledgeItem.section == "instructions",
                KnowledgeItem.metadata_json["contentType"].astext == "intent_prompt"
            ),
            KnowledgeItem.is_active.is_(True),
            KnowledgeItem.language == language,
            KnowledgeItem.organization_id.is_(None),
        )
        .distinct(KnowledgeItem.category)
        .all()
    )
    return [{"category": cat, "title": title} for cat, title in instructions]


def classify_intent(db: Session, question: str, language: str) -> str:
    """Classify user question into an intent using LLM.
    
    Args:
        db: Database session
        question: User's question text
        language: Language code (e.g. 'pl')
    
    Returns:
        Intent class string (e.g. 'shadow_sides', 'action_plan') or 'default'
    """
    available = get_available_intents(db, language)
    if not available:
        logger.info("No instruction intents found in KB, using default")
        return DEFAULT_INTENT

    # Build intent classes list for the prompt
    intent_classes = "\n".join(
        f"- {item['category']}: {item['title']}"
        for item in available
    )
    valid_categories = {item["category"].lower().strip() for item in available}

    # Get classifier model and prompt template from settings
    classifier_model = get_setting(db, "intent_classifier_model")
    prompt_template = get_setting(db, "intent_classifier_prompt")

    if not prompt_template:
        logger.warning("No intent_classifier_prompt configured, using default")
        return DEFAULT_INTENT

    # Build the classification prompt
    prompt_text = prompt_template.format(
        question=question,
        intent_classes=intent_classes,
    )

    try:
        from services.assistant_service import get_openrouter_client

        client = get_openrouter_client()
        response = client.chat.completions.create(
            model=classifier_model,
            messages=[{"role": "user", "content": prompt_text}],
            temperature=0.1,
            max_tokens=50,
        )
        raw_intent = response.choices[0].message.content.strip().lower()

        # Validate against known intents
        if raw_intent in valid_categories:
            logger.info(f"Intent classified: '{raw_intent}' for question: '{question[:60]}...'")
            return raw_intent

        # Try partial match (in case LLM adds extra text)
        for category in valid_categories:
            if category in raw_intent:
                logger.info(f"Intent partial match: '{category}' from '{raw_intent}'")
                return category

        logger.info(f"Intent not matched (LLM returned '{raw_intent}'), using default")
        return DEFAULT_INTENT

    except OpenAIError as e:
        logger.error(f"Intent classification failed: {e}")
        return DEFAULT_INTENT
    except Exception as e:
        logger.error(f"Unexpected error in intent classification: {e}")
        return DEFAULT_INTENT
