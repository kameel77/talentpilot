"""Service for mapping raw talent names from Gallup reports to talent codes."""

from typing import Dict, Optional
import re

# Talent name mapping (PL/EN -> code)
# This could be moved to the database in the future, but for now we use a hardcoded map
# based on the seed data for performance and simplicity.

TALENT_MAP: Dict[str, str] = {
    # EN names
    "achiever": "achiever",
    "activator": "activator",
    "adaptability": "adaptability",
    "analytical": "analytical",
    "arranger": "arranger",
    "belief": "belief",
    "command": "command",
    "communication": "communication",
    "competition": "competition",
    "connectedness": "connectedness",
    "consistency": "consistency",
    "context": "context",
    "deliberative": "deliberative",
    "developer": "developer",
    "discipline": "discipline",
    "empathy": "empathy",
    "focus": "focus",
    "futuristic": "futuristic",
    "harmony": "harmony",
    "ideation": "ideation",
    "includer": "includer",
    "individualization": "individualization",
    "input": "input",
    "intellection": "intellection",
    "learner": "learner",
    "maximizer": "maximizer",
    "positivity": "positivity",
    "relator": "relator",
    "responsibility": "responsibility",
    "restorative": "restorative",
    "self assurance": "self-assurance",
    "self-assurance": "self-assurance",
    "self_assurance": "self-assurance",
    "significance": "significance",
    "strategic": "strategic",
    "woo": "woo",
    
    # PL names
    "osiąganie": "achiever",
    "aktywator": "activator",
    "elastyczność": "adaptability",
    "analityk": "analytical",
    "organizator": "arranger",
    "pryncypialność": "belief",
    "dowodzenie": "command",
    "komunikatywność": "communication",
    "rywalizacja": "competition",
    "współzależność": "connectedness",
    "bezstronność": "consistency",
    "kontekst": "context",
    "rozwaga": "deliberative",
    "rozwijanie": "developer",
    "dyscyplina": "discipline",
    "empatia": "empathy",
    "ukierunkowanie": "focus",
    "wizjoner": "futuristic",
    "zgodność": "harmony",
    "odkrywczość": "ideation",
    "integrator": "includer",
    "indywidualizacja": "individualization",
    "zbieranie": "input",
    "intelekt": "intellection",
    "uczenie się": "learner",
    "maksymalista": "maximizer",
    "optymista": "positivity",
    "bliskość": "relator",
    "odpowiedzialność": "responsibility",
    "naprawianie": "restorative",
    "wiara w siebie": "self-assurance",
    "poważanie": "significance",
    "strateg": "strategic",
    "czar": "woo",

    # No-space variants (PDF extraction often concatenates words)
    "uczeniesię": "learner",
    "wiarawsiebie": "self-assurance",
    "rozwijanieinnych": "developer",
    "współzależność": "connectedness",
    "rozwijanie innych": "developer",
}


def normalize_name(name: str) -> str:
    """Normalize talent name for mapping."""
    # Remove extra spaces, lowercase, normalize separators
    name = name.lower().strip()
    # Replace hyphens and underscores with spaces (preserves multi-word names like "self assurance")
    name = re.sub(r"[-_]", " ", name)
    # Remove other punctuation
    name = re.sub(r"[.:)]", "", name)
    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name).strip()
    return name


def map_talent_name_to_code(raw_name: str) -> Optional[str]:
    """Map a raw talent name from a report to its internal code."""
    normalized = normalize_name(raw_name)
    
    # Direct match
    if normalized in TALENT_MAP:
        return TALENT_MAP[normalized]
        
    # Partial matching (for cases where PDF extraction might be slightly messy)
    for key, code in TALENT_MAP.items():
        if key in normalized or normalized in key:
            if len(normalized) > 3: # Avoid matching very short fragments
                return code
                
    return None


def get_talent_translation(code: str, language: str = "en") -> str:
    """Get the translated name for a talent code."""
    # This is a bit reverse, but useful for the API response
    # In a real app, this should probably come from the database translations
    
    for name, c in TALENT_MAP.items():
        if c == code:
            # Simple heuristic: if language is PL, look for a key that isn't the code itself 
            # and isn't purely ASCII if possible, or just use a predefined list.
            # For now, we'll return the code if we can't find a better match.
            pass
            
    return code # Fallback
