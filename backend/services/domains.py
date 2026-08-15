"""CliftonStrengths domain names and classifications.

Single source of truth on the backend — no router or service should define
its own local domain dictionary.
"""
from typing import Dict

# Full official Gallup domain names in PL and EN
DOMAIN_NAMES: Dict[str, Dict[str, str]] = {
    "pl": {
        "executing": "Wykonywanie",
        "influencing": "Wywieranie wpływu",
        "relationship_building": "Budowanie relacji",
        "strategic_thinking": "Myślenie strategiczne",
    },
    "en": {
        "executing": "Executing",
        "influencing": "Influencing",
        "relationship_building": "Relationship Building",
        "strategic_thinking": "Strategic Thinking",
    },
}

# Short/compact labels for cards, badges and compact tables
DOMAIN_NAMES_SHORT: Dict[str, Dict[str, str]] = {
    "pl": {
        "executing": "Wykonywanie",
        "influencing": "Wpływ",
        "relationship_building": "Relacje",
        "strategic_thinking": "Strategia",
    },
    "en": {
        "executing": "Executing",
        "influencing": "Influence",
        "relationship_building": "Relationships",
        "strategic_thinking": "Strategy",
    },
}

# Bilingual label with English in parentheses (e.g. for assistant instructions, knowledge tags)
DOMAIN_LABELS_BILINGUAL: Dict[str, str] = {
    "executing": "Wykonywanie (Executing)",
    "influencing": "Wywieranie wpływu (Influencing)",
    "relationship_building": "Budowanie relacji (Relationship Building)",
    "strategic_thinking": "Myślenie strategiczne (Strategic Thinking)",
}


def get_domain_name(domain: str, language: str = "pl", short: bool = False) -> str:
    """Get localized domain name with fallback to code."""
    lang_map = DOMAIN_NAMES_SHORT.get(language, DOMAIN_NAMES_SHORT["pl"]) if short else DOMAIN_NAMES.get(language, DOMAIN_NAMES["pl"])
    return lang_map.get(domain, domain)
