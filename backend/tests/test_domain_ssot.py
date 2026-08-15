"""Unit tests asserting Single Source of Truth (SSoT) for CliftonStrengths domains.

Ensures backend services.domains and frontend gallup-data.ts are strictly synchronized,
preventing drift or re-emergence of incorrect domain names (e.g. 'Realizowanie').
"""
import json
import re
from pathlib import Path
from services.domains import DOMAIN_NAMES, DOMAIN_NAMES_SHORT, DOMAIN_LABELS_BILINGUAL


def test_backend_domains_definitions():
    """Verify backend domain source of truth contains exact canonical names."""
    expected_pl = {
        "executing": "Wykonywanie",
        "influencing": "Wywieranie wpływu",
        "relationship_building": "Budowanie relacji",
        "strategic_thinking": "Myślenie strategiczne",
    }
    expected_en = {
        "executing": "Executing",
        "influencing": "Influencing",
        "relationship_building": "Relationship Building",
        "strategic_thinking": "Strategic Thinking",
    }

    assert DOMAIN_NAMES["pl"] == expected_pl
    assert DOMAIN_NAMES["en"] == expected_en
    assert DOMAIN_NAMES_SHORT["pl"]["executing"] == "Wykonywanie"
    assert DOMAIN_NAMES_SHORT["pl"]["influencing"] == "Wpływ"
    assert DOMAIN_NAMES_SHORT["pl"]["relationship_building"] == "Relacje"
    assert DOMAIN_NAMES_SHORT["pl"]["strategic_thinking"] == "Strategia"


def test_frontend_gallup_data_synchronization():
    """Verify frontend/lib/gallup-data.ts matches backend domain names exactly."""
    repo_root = Path(__file__).resolve().parent.parent.parent
    gallup_data_file = repo_root / "frontend" / "lib" / "gallup-data.ts"
    assert gallup_data_file.exists(), f"Missing {gallup_data_file}"

    content = gallup_data_file.read_text(encoding="utf-8")

    # Assert DOMAIN_LABELS entries in TS file
    for domain, pl_name in DOMAIN_NAMES["pl"].items():
        en_name = DOMAIN_NAMES["en"][domain]
        pattern = rf"{domain}:\s*\{{\s*en:\s*['\"]{re.escape(en_name)}['\"],\s*pl:\s*['\"]{re.escape(pl_name)}['\"]\s*\}}"
        assert re.search(pattern, content), f"Mismatch for {domain} in gallup-data.ts: expected pl='{pl_name}', en='{en_name}'"
