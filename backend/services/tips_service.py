"""Tips service — AI-powered actionable insights generation."""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from models import AITip, User
from services.assistant_service import (
    get_openrouter_client,
    get_user_talents,
    retrieve_knowledge,
    get_embedding,
    DOMAIN_LABELS,
)
from services.compare_service import compare_users, get_user_talents_for_compare
from services.settings_service import get_setting

logger = logging.getLogger(__name__)

# ─── Prompt Templates ───

DAILY_TIP_SYSTEM_PROMPT = (
    "Jesteś coachem rozwojowym w aplikacji TalentPilot opartej na metodologii CliftonStrengths (Gallup). "
    "Twoim zadaniem jest wygenerowanie JEDNEJ, konkretnej wskazówki na dziś dla pracownika.\n\n"
    "ZASADY:\n"
    "- Wskazówka MUSI być actionable — co dokładnie zrobić DZIŚ (nie ogólnik)\n"
    "- Maksymalnie 3 zdania na wskazówkę\n"
    "- Dodaj 1 zdanie: dlaczego to działa (odwołaj się do talentu)\n"
    "- Dodaj 1 zdanie: jak powiedzieć o tym liderowi / jak tego użyć w rozmowie 1:1\n"
    "- Pisz w języku polskim, bezpośrednio do użytkownika (\"Ty\")\n"
    "- Bądź konkretny: podaj przykładowe zdania, zachowania, pytania do zadania\n"
    "- NIE pisz nagłówków, punktów, ani list — czysty tekst\n\n"
    "FORMAT ODPOWIEDZI (ŚCIŚLE PRZESTRZEGAJ):\n"
    "WSKAZÓWKA: [Twoja konkretna wskazówka na dziś — co zrobić, z kim, jak]\n"
    "DLACZEGO: [Dlaczego to działa — odwołanie do talentu]\n"
    "DLA LIDERA: [Jak powiedzieć o tym liderowi / użyć w 1:1]\n"
)

SYNERGY_TIP_SYSTEM_PROMPT = (
    "Jesteś coachem relacji w zespole w aplikacji TalentPilot opartej na CliftonStrengths (Gallup). "
    "Twoim zadaniem jest wygenerowanie 3-zdaniowej 'instrukcji obsługi relacji' między dwoma osobami.\n\n"
    "ZASADY:\n"
    "- Zdanie 1: Co łączy te osoby (wspólne talenty/domeny = naturalne porozumienie)\n"
    "- Zdanie 2: Co może generować tarcie (różnice w dominujących domenach)\n"
    "- Zdanie 3: Konkretna rada co zrobić DZIŚ w interakcji z tą osobą\n"
    "- Pisz w języku polskim, bezpośrednio do użytkownika (\"Ty\" i \"ta osoba\" / imię)\n"
    "- Bądź konkretny: podaj przykładowe zachowania, pytania, frazy\n"
    "- NIE pisz list ani nagłówków — 3 czyste zdania\n"
)

CONTEXT_LABELS = {
    "general": "ogólna wskazówka na dziś",
    "feedback": "przygotowanie do dawania lub odbierania feedbacku",
    "one_on_one": "przygotowanie do spotkania 1:1 z liderem",
    "conflict": "radzenie sobie z konfliktem lub napięciem w zespole",
    "motivation": "odzyskanie motywacji lub energii w pracy",
}


def _format_talents_block(talents: list[dict]) -> str:
    """Format user talents into a readable block for the prompt."""
    if not talents:
        return "Brak danych o talentach."
    lines = []
    for t in talents:
        domain_label = DOMAIN_LABELS.get(t["domain"], t["domain"])
        prefix = "[TOP 5] " if t["rank"] <= 5 else ""
        lines.append(f"{prefix}Rank {t['rank']}: {t['name']} (Domena: {domain_label})")
    return "\n".join(lines)


def generate_daily_tip(
    db: Session,
    user: User,
    context: str = "general",
    language: str = "pl",
) -> dict:
    """Generate an AI-powered daily tip based on user's talents and context."""
    talents = get_user_talents(db, user.id, language)
    if not talents:
        return {
            "content": "Zaimportuj swoje talenty CliftonStrengths, aby otrzymać spersonalizowane wskazówki.",
            "talent_focus": "",
            "context": context,
        }

    context_label = CONTEXT_LABELS.get(context, CONTEXT_LABELS["general"])
    top_talent = talents[0]["name"] if talents else "General"

    # Build the user prompt with talent context
    talents_block = _format_talents_block(talents)

    # Get knowledge items via RAG for richer context
    tip_query = f"Wskazówka na dziś dla osoby z talentami CliftonStrengths: {context_label}"
    try:
        query_embedding = get_embedding(db, tip_query)
        knowledge_items = retrieve_knowledge(
            db, user.organization_id, query_embedding, language, top_k=3
        )
        knowledge_section = "\n".join(f"- {item.content}" for item in knowledge_items) if knowledge_items else ""
    except Exception:
        knowledge_section = ""

    user_message = (
        f"Talenty użytkownika:\n{talents_block}\n\n"
        f"Kontekst: {context_label}\n"
    )
    if knowledge_section:
        user_message += f"\nDodatkowa wiedza:\n{knowledge_section}\n"

    user_message += "\nWygeneruj wskazówkę."

    # Generate via LLM
    try:
        client = get_openrouter_client()
        model_name = get_setting(db, "openrouter_chat_model")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": DAILY_TIP_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Tips LLM error: {e}")
        return {
            "content": "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
            "talent_focus": top_talent,
            "context": context,
        }

    # Save to DB
    tip = AITip(
        user_id=user.id,
        tip_content=answer,
        talent_focus=top_talent,
        context=context,
    )
    db.add(tip)
    db.commit()
    db.refresh(tip)

    return {
        "tip_id": tip.id,
        "content": answer,
        "talent_focus": top_talent,
        "context": context,
    }


def generate_synergy_tip(
    db: Session,
    current_user: User,
    target_user: User,
    language: str = "pl",
) -> dict:
    """Generate a synergy tip for interacting with a specific team member.
    
    Combines deterministic compare data with AI-generated interaction guide.
    """
    # Get deterministic compare data (instant)
    compare_result = compare_users(db, current_user, target_user, language)

    # Get talents for the AI prompt
    talents_me = get_user_talents(db, current_user.id, language)
    talents_them = get_user_talents(db, target_user.id, language)

    if not talents_me:
        return {
            "content": "Zaimportuj swoje talenty CliftonStrengths, aby otrzymać wskazówki relacyjne.",
            "talent_focus": "",
            "shared_talents": [],
            "synergy_score": 0,
        }

    # Build AI prompt for interaction guide
    my_block = _format_talents_block(talents_me[:5])
    their_block = _format_talents_block(talents_them[:5]) if talents_them else "Brak danych o talentach."

    shared_names = [s["name"] for s in compare_result["shared_talents"]]
    shared_info = f"Wspólne talenty: {', '.join(shared_names)}" if shared_names else "Brak wspólnych talentów w Top 10."

    user_message = (
        f"Moje Top 5 talentów:\n{my_block}\n\n"
        f"Top 5 talentów osoby (imię: {target_user.full_name}):\n{their_block}\n\n"
        f"{shared_info}\n\n"
        f"Wygeneruj 3-zdaniową instrukcję obsługi relacji."
    )

    # Generate via LLM
    try:
        client = get_openrouter_client()
        model_name = get_setting(db, "openrouter_chat_model")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYNERGY_TIP_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.6,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Synergy tip LLM error: {e}")
        answer = "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę."

    # Save to DB
    tip = AITip(
        user_id=current_user.id,
        tip_content=answer,
        talent_focus=f"synergy:{target_user.id}",
        context="synergy",
    )
    db.add(tip)
    db.commit()
    db.refresh(tip)

    return {
        "tip_id": tip.id,
        "content": answer,
        "target_user_name": target_user.full_name,
        "shared_talents": compare_result["shared_talents"],
        "synergy_score": compare_result["synergy_score"],
        "collaboration_tips": compare_result["collaboration_tips"],
        "domain_balance": compare_result["domain_balance"],
    }
