from services.gallup_pdf_parser import extract_ranked_talents, clean_talent_name, extract_person_name, GallupPersonInfo
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


# ---------- extract_person_name tests ----------

def test_person_name_en_with_pipe_and_date():
    """Format: 'KAMIL TONKOWICZ | 04-03-2021'"""
    pages = ["KAMIL TONKOWICZ | 04-03-2021\nYour CliftonStrengths 34 Results"]
    info = extract_person_name(pages)
    assert info.first_name == "Kamil"
    assert info.last_name == "Tonkowicz"


def test_person_name_pl_with_pipe_and_date():
    """Format: 'JOANNA TONKOWICZ | 05-02-2025'"""
    pages = ["JOANNA TONKOWICZ | 05-02-2025\nTwoje wyniki badania CliftonStrengths 34"]
    info = extract_person_name(pages)
    assert info.first_name == "Joanna"
    assert info.last_name == "Tonkowicz"


def test_person_name_no_space_around_pipe():
    """Format: 'ANNA MRÓZ|03-06-2026'"""
    pages = ["ANNA MRÓZ|03-06-2026\nTwoje wyniki badania CliftonStrengths 34"]
    info = extract_person_name(pages)
    assert info.first_name == "Anna"
    assert info.last_name == "Mróz"


def test_person_name_no_date():
    """Format: 'DONALD CLIFTON' (no pipe, no date)"""
    pages = ["DONALD CLIFTON\nYour CliftonStrengths 34 Results"]
    info = extract_person_name(pages)
    assert info.first_name == "Donald"
    assert info.last_name == "Clifton"


def test_person_name_with_polish_chars():
    """Format: 'KAROLINA MITRASZEWSKA | 04-10-2025'"""
    pages = ["KAROLINA MITRASZEWSKA | 04-10-2025\nYour CliftonStrengths 34"]
    info = extract_person_name(pages)
    assert info.first_name == "Karolina"
    assert info.last_name == "Mitraszewska"


def test_person_name_multiple_first_names():
    """Three words → first two as first_name, last as last_name."""
    pages = ["ANNA MARIA KOWALSKA | 01-01-2025\nResults"]
    info = extract_person_name(pages)
    assert info.first_name == "Anna Maria"
    assert info.last_name == "Kowalska"


def test_person_name_single_word():
    """Only one word in header → first_name only."""
    pages = ["MADONNA\nResults"]
    info = extract_person_name(pages)
    assert info.first_name == "Madonna"
    assert info.last_name is None


def test_person_name_empty_pages():
    """No pages → empty person info."""
    info = extract_person_name([])
    assert info.first_name is None
    assert info.last_name is None


def test_person_name_empty_first_page():
    """Empty first page → empty person info."""
    info = extract_person_name([""])
    assert info.first_name is None
    assert info.last_name is None
