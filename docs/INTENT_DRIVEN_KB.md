# Intent-Driven Knowledge Base — Dokumentacja modułu

## Cel

Moduł **Intent-Driven KB** dynamicznie steruje formatem odpowiedzi AI w Q&A Copilot.
Zamiast jednego sztywnego system prompta, odpowiedź jest formatowana na podstawie **intencji pytania** użytkownika.

---

## Jak to działa

```
 Pytanie użytkownika
        │
        ▼
 ┌──────────────────┐
 │ Intent Classifier │ ← osobny, lekki model LLM (np. gpt-4.1-nano)
 │  (intent_service) │ ← prompt i model konfigurowane w Admin → Ustawienia AI
 └────────┬─────────┘
          │ zwraca klasę intencji (np. "shadow_sides", "action_plan")
          ▼
 ┌──────────────────┐
 │ Retrieve          │ ← KB sekcja "instructions", filtr: category == intent
 │ Instruction       │
 └────────┬─────────┘
          │ treść instrukcji formatu (lub None jeśli brak)
          ▼
 ┌──────────────────┐
 │ Build Prompt      │ ← INSTRUKCJA FORMATU + Kontekst talentów + Wiedza + Pytanie
 │ + Generate Answer │ ← główny model LLM (konfigurowalny)
 └────────┬─────────┘
          │
          ▼
   Odpowiedź w formacie
   dopasowanym do intencji
```

---

## Kluczowe pliki

| Plik | Rola |
|------|------|
| `backend/services/intent_service.py` | Klasyfikator intencji — pobiera klasy z KB, wywołuje LLM |
| `backend/services/assistant_service.py` | `retrieve_instruction()` — pobiera instrukcję z KB; `build_prompt()` — buduje prompt z instrukcją |
| `backend/services/settings_service.py` | Domyślne wartości: `intent_classifier_model`, `intent_classifier_prompt` |
| `backend/routers/qa.py` | Pipeline Q&A — integruje: classify → instruction → generate |
| `frontend/.../knowledge/instructions/page.tsx` | UI: zarządzanie instrukcjami w KB |
| `frontend/.../settings/page.tsx` | UI: konfiguracja modelu i promptu klasyfikatora |

---

## Konfiguracja (Admin → Ustawienia AI)

### Model klasyfikatora
- Klucz: `intent_classifier_model`
- Domyślnie: `openai/gpt-4.1-nano`
- Powinien być szybki i tani — klasyfikacja to jedno krótkie zapytanie

### Prompt klasyfikatora
- Klucz: `intent_classifier_prompt`
- Placeholder `{question}` — wstawiane jest pytanie użytkownika
- Placeholder `{intent_classes}` — wstawiana jest lista klas intencji z KB (sekcja Instrukcje)

---

## Dodawanie nowej intencji

1. Wejdź w **Admin → Baza wiedzy → Instrukcje odpowiedzi**
2. Kliknij **Dodaj wpis**
3. Wypełnij:
   - **Kategoria** = klasa intencji (np. `shadow_sides`, `action_plan`, `team_dynamics`)
   - **Tagi** = słowa kluczowe pomocnicze
   - **Treść** = instrukcja formatu, np.:
     ```
     Gdy pytanie dotyczy piwnic/cieni talentu, odpowiedz w formacie:
     
     Talent: [Nazwa]
     Piwnice (potencjalne ryzyka):
     1) [opis]
     2) [opis]
     
     Jak zarządzić cieniami:
     1) [strategia]
     2) [strategia]
     ```
4. Zapisz — od teraz pytania pasujące do tej intencji będą formatowane wg podanej instrukcji

---

## Fallback

Gdy klasyfikator nie dopasuje żadnej klasy (lub brak wpisów w sekcji Instrukcje):
- `intent = "default"`
- Instrukcja = `None`
- Odpowiedź generowana jest z domyślnym formatem z system prompta (Talent/Kompetencja/Akcja)

---

## Optymalizacja

- **Klasyfikator** działa na lekkim modelu (np. nano/flash) → dodaje ~1-3s do pipeline
- **Klasy intencji** są cachowalne (przyszła optymalizacja)
- Jeśli sekcja Instrukcje jest pusta → klasyfikator nie jest wywoływany (skip LLM call)
