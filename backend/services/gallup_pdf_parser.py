"""Utilities for extracting Gallup talent rankings from PDF reports."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

import pdfplumber

from services.talent_name_mapper import map_talent_name_to_code

RESULT_KEYWORDS = (
    "cliftonstrengths",
    "top 5",
    "top 10",
    "twoje talenty",
    "talenty",
    "strengths",
    "results",
    "your cliftonstrengths 34 results",
    "wyniki cliftonstrengths",
)

RANKED_TALENT_PATTERN = re.compile(
    r"(?m)^\s*(\d{1,2})\s*[.\-:)]+\s*([A-Za-zÀ-ÖØ-öø-ÿąćęłńóśźżĄĆĘŁŃÓŚŹŻ'’\- ]{2,})"
)


@dataclass(frozen=True)
class GallupPageMatch:
    index: int
    text: str
    rank_count: int
    keyword_hits: int


def extract_pdf_pages_text(pdf_path: str) -> List[str]:
    """Extract text from every page of a PDF. Falls back to OCR if needed."""
    pages: List[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                # If page has no text, it might be scanned
                if not text or len(text.strip()) < 10:
                    # TODO: Implement OCR fallback with pytesseract
                    # For now, we skip or log
                    pages.append("")
                else:
                    pages.append(text)
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []
    return pages


def _count_keyword_hits(text: str, keywords: Iterable[str]) -> int:
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword in lowered)


def find_results_page(pages_text: List[str], keywords: Iterable[str] = RESULT_KEYWORDS) -> Optional[GallupPageMatch]:
    """Find the most likely results page based on keywords and ranking patterns."""
    candidates: List[GallupPageMatch] = []
    for index, text in enumerate(pages_text):
        if not text:
            continue
        rank_count = len(RANKED_TALENT_PATTERN.findall(text))
        keyword_hits = _count_keyword_hits(text, keywords)
        if rank_count > 0 or keyword_hits > 0:
            candidates.append(
                GallupPageMatch(
                    index=index,
                    text=text,
                    rank_count=rank_count,
                    keyword_hits=keyword_hits,
                )
            )

    if not candidates:
        print("[PDF Parser] No results page candidates found")
        return None

    # Sort by rank_count (primary) and keyword_hits (secondary)
    best = max(
        candidates,
        key=lambda match: (match.rank_count, match.keyword_hits),
    )
    print(f"[PDF Parser] Selected page {best.index} with {best.rank_count} talent matches, {best.keyword_hits} keyword hits")
    return best


def extract_ranked_talents(text: str) -> Dict[str, int]:
    """Extract talent codes with their ranking numbers from text."""
    results: Dict[str, int] = {}
    matches = RANKED_TALENT_PATTERN.findall(text)
    
    print(f"[PDF Parser] Found {len(matches)} ranking matches in text")
    
    for rank_str, raw_name in matches:
        rank = int(rank_str)
        if rank < 1 or rank > 34:
            continue
        
        name = clean_talent_name(raw_name)
        if not name:
            continue
            
        talent_code = map_talent_name_to_code(name)
        if talent_code:
            results[talent_code] = rank
        else:
            print(f"[PDF Parser] Could not map talent: rank={rank}, name='{raw_name}' -> cleaned='{name}'")
            
    print(f"[PDF Parser] Mapped {len(results)} talents: {results}")
    return results


def clean_talent_name(raw_name: str) -> str:
    """Clean extracted talent names by removing known trailing phrases."""
    cleaned_name = raw_name
    unwanted_suffixes = [
        "How do I manage my weaknesses",
        "If you answered yes to any of these questions",
        "weaknesses",
        "CliftonStrengths themes might prevent you from maximizing your potential",
        "Focusing on your CliftonStrengths doesn’t mean you can ignore your",
        "To identify potential weaknesses",
        "Słabe strony",
        "Jak zarządzać słabymi stronami",
    ]

    unwanted_suffixes.sort(key=len, reverse=True)
    for suffix in unwanted_suffixes:
        pattern = re.compile(r"\s+" + re.escape(suffix) + r"(?:[.\s]*)$", re.IGNORECASE)
        cleaned_name = pattern.sub("", cleaned_name).strip()

    return re.sub(r"\s+", " ", cleaned_name).strip(" .-–—:\t")


def extract_gallup_rankings(pdf_path: str) -> Tuple[Dict[str, int], Optional[int]]:
    """Extract Gallup rankings JSON and return it with the page index used."""
    pages_text = extract_pdf_pages_text(pdf_path)
    match = find_results_page(pages_text)
    if not match:
        return {}, None
    return extract_ranked_talents(match.text), match.index


def dump_rankings_json(rankings: Dict[str, int]) -> str:
    """Serialize rankings to JSON string."""
    return json.dumps(rankings, ensure_ascii=False, indent=2, sort_keys=True)
