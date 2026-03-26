from services.gallup_pdf_parser import extract_ranked_talents, clean_talent_name
from services.talent_name_mapper import map_talent_name_to_code

def test_clean_talent_name():
    assert clean_talent_name("Achiever - How do I manage my weaknesses") == "Achiever"
    assert clean_talent_name("Osiąganie Słabe strony") == "Osiąganie"
    assert clean_talent_name("  Analytical.  ") == "Analytical"

def test_map_talent_name_to_code():
    assert map_talent_name_to_code("Achiever") == "achiever"
    assert map_talent_name_to_code("Osiąganie") == "achiever"
    assert map_talent_name_to_code("Osiąganie.") == "achiever"
    assert map_talent_name_to_code("Unknown") is None

def test_extract_ranked_talents_pl():
    text = """
    Twoje wyniki:
    1. Osiąganie
    2. Organizacja
    3. Strateg
    4. Empatia
    5. Bliskość
    """
    results = extract_ranked_talents(text)
    assert results["achiever"] == 1
    assert results["arranger"] == 2
    assert results["strategic"] == 3
    assert results["empathy"] == 4
    assert results["relator"] == 5

def test_extract_ranked_talents_en():
    text = """
    Your Results:
    1. Achiever
    2. Arranger
    3. Strategic
    4. Empathy
    5. Relator
    """
    results = extract_ranked_talents(text)
    assert results["achiever"] == 1
    assert results["arranger"] == 2
    assert results["strategic"] == 3
    assert results["empathy"] == 4
    assert results["relator"] == 5

def test_extract_ranked_talents_section_header_inline():
    """Regression: pdfplumber merges the STRENGTHEN/NAVIGATE column headers onto
    the same line as the first entry in each column (rank 1 and rank 11),
    breaking the line-start anchor of the ranking regex."""
    text = "STRENGTHEN 1. Learner\n2. Arranger\nNAVIGATE 11. Relator\n12. Belief\n"
    results = extract_ranked_talents(text)
    assert results["learner"] == 1
    assert results["arranger"] == 2
    assert results["relator"] == 11
    assert results["belief"] == 12


def test_extract_ranked_talents_messy():
    text = """
    Results:
    1. Achiever (How to manage...)
    2.   Arranger  - weaknesses
    10. Strategic
    34. Woo
    """
    results = extract_ranked_talents(text)
    assert results["achiever"] == 1
    assert results["arranger"] == 2
    assert results["strategic"] == 10
    assert results["woo"] == 34
