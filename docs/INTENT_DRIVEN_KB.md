# Intent-Driven Knowledge Base — Dokumentacja modułu

## Cel

Moduł **Intent-Driven KB** dynamicznie steruje **formatem odpowiedzi** AI w Q&A Copilot.
Zamiast jednego sztywnego parsera (Talent/Kompetencja/Akcja), odpowiedź jest formatowana i renderowana w zależności od **intencji pytania** użytkownika.

---

## Architektura — pełny flow

```
 Pytanie użytkownika
        │
        ▼
 ┌──────────────────┐
 │ Intent Classifier │ ← lekki LLM (np. gpt-4.1-nano)
 │  (intent_service) │ ← model + prompt konfigurowane w Admin → Ustawienia AI
 └────────┬─────────┘
          │ zwraca klasę intencji (np. "shadow_sides")
          ▼
 ┌──────────────────┐
 │ Retrieve          │ ← KB sekcja "instructions", filtr: category == intent
 │ Instruction       │ ← zwraca: (treść instrukcji, render_mode)
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │ Generate Answer   │ ← główny LLM z wstrzykniętą instrukcją formatu
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │ Conditional Parse │ ← render_mode == "structured" → parse do boxów
 │                   │ ← render_mode != "structured" → zwróć surowy tekst
 └────────┬─────────┘
          │ answer + answer_raw + render_mode
          ▼
 ┌──────────────────┐
 │ Frontend Renderer │ ← rejestr rendererów: structured / freeform / ...
 │ Registry          │
 └──────────────────┘
```

---

## Kluczowe pliki

### Backend

| Plik | Rola |
|------|------|
| `services/intent_service.py` | Klasyfikator intencji: pobiera klasy z KB, wywołuje LLM |
| `services/assistant_service.py` | `retrieve_instruction()` → zwraca `(content, render_mode)` z `metadata_json.render_mode` |
| `services/settings_service.py` | Domyślne: `intent_classifier_model`, `intent_classifier_prompt` |
| `routers/qa.py` | Pipeline: classify → instruction → generate → conditional parse |
| `schemas.py` | `QAQueryResponse` + `QAHistoryItem` z polami `answer_raw`, `render_mode` |

### Frontend

| Plik | Rola |
|------|------|
| `components/qa/QARenderers.tsx` | **Rejestr rendererów**: `StructuredRenderer`, `FreeformRenderer`, `getRenderer()` |
| `app/.../qa/page.tsx` | Dynamicznie wybiera renderer wg `render_mode` z API response |
| `components/knowledge/KnowledgeEntryManager.tsx` | Dropdown "Tryb renderowania" (tylko w sekcji Instrukcje) |
| `lib/api.ts` | Typy z `answer_raw`, `render_mode` |

---

## Render Modes

| `render_mode` | Renderer | Opis |
|---------------|----------|------|
| `structured` | `StructuredRenderer` | 3 boxy: Talent / Kompetencja / Akcja (domyślny) |
| `freeform` | `FreeformRenderer` | Swobodny tekst z formatowaniem nagłówków, list i bold |

### Dodawanie nowego render mode

1. **Developer**: Utwórz nowy komponent w `QARenderers.tsx` implementujący `RendererProps`
2. **Developer**: Dodaj go do mapy `RENDERERS` w tym samym pliku
3. **Developer**: Dodaj opcję do dropdownu w `KnowledgeEntryManager.tsx` (sekcja "Tryb renderowania")
4. **Admin**: Przy tworzeniu instrukcji w KB → wybierz nowy tryb z dropdownu

> **Ważne:** Dodanie nowej intencji, która używa istniejącego renderera, NIE wymaga zmian w kodzie.

---

## Konfiguracja (Admin → Ustawienia AI)

### Model klasyfikatora
- Klucz: `intent_classifier_model`
- Domyślnie: `openai/gpt-4.1-nano`
- Powinien być szybki i tani

### Prompt klasyfikatora
- Klucz: `intent_classifier_prompt`
- `{question}` → pytanie użytkownika
- `{intent_classes}` → lista klas z KB (auto-generated)

---

## Dodawanie nowej intencji (Admin, bez kodu)

1. **Admin → Baza wiedzy → Instrukcje odpowiedzi → Dodaj**
2. Wypełnij:
   - **Kategoria** = klasa intencji (np. `shadow_sides`)
   - **Typ treści** = `Instrukcja intencji (Intent Prompt)`
   - **Tryb renderowania** = `Freeform` lub `Structured`
   - **Treść** = instrukcja formatu dla LLM:
     ```
     Odpowiedz w formacie:
     
     Talent: [Nazwa]
     Piwnice (ryzyka):
     1) [opis]
     
     Strategie zarządzania:
     1) [strategia]
     ```

---

## API Response

```json
{
    "query_id": 42,
    "answer_id": 101,
    "answer": {
        "talent": "Dyscyplina",
        "competency": "General Management",
        "actions": ["..."],
        "fallback": false
    },
    "answer_raw": "Talent: Dyscyplina\nPiwnice...",
    "render_mode": "freeform",
    "source": "ai+talent-mapping"
}
```

- `answer` → zawsze wypełniony (structured: parsed, freeform: puste pola)
- `answer_raw` → surowy tekst LLM (dla rendererów niestandardowych)
- `render_mode` → sygnał dla frontendu, który renderer użyć

---

## Fallback

- Brak wpisów w sekcji Instrukcje → klasyfikator pomijany → `render_mode = "structured"`
- Klasyfikator nie dopasuje klasy → `intent = "default"` → `render_mode = "structured"`
- Nieznany `render_mode` na froncie → fallback do `StructuredRenderer`
