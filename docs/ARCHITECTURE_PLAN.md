# Plan Architektury Rozwiązania

## Infrastruktura (Hetzner + Coolify)
- **Frontend Asset:** Next.js (PWA ready).
- **Backend Asset:** FastAPI (REST API).
- **Database Asset:** PostgreSQL z rozszerzeniem `pgvector`.
- **Cache Asset:** Redis (opcjonalnie dla sesji i wyników RAG).

## Przepływ danych (RAG Flow)
1. **Input:** Zapytanie managera o pracownika.
2. **Processing:** Python generuje embedding zapytania.
3. **Retrieval:** Przeszukiwanie Postgresa pod kątem wiedzy o talentach danego pracownika.
4. **Generation:** LLM (OpenAI/Anthropic) składa poradę w oparciu o znaleziony kontekst.
5. **Output:** Frontend wyświetla "Quick Tip" w UI.

## Strategia API (Desktop & Mobile)
- **Stateless REST API:** Backend nie odróżnia urządzenia. Wszystkie dane idą przez JSON.
- **Diferencjacja odpowiedzi:** Implementujemy parametr `?view=compact/full`. 
    - Mobile (PWA) pobiera tylko kluczowe "Daily Tips" i "Quick Stats".
    - Desktop pobiera pełne macierze danych i wykresy analityczne.
- **Push Gateway:** Backend musi posiadać moduł integracji z Web Push API (dla PWA), aby wysyłać powiadomienia o spotkaniach niezależnie od platformy.

## Specyfikacja RAG (Intelligence Layer)
- **Vektor Store:** Rozszerzenie `pgvector` w PostgreSQL.
- **Embedding Model:** `multilingual-e5-small` (lokalnie) lub `text-embedding-3-small` (OpenAI).
- **Metadata Filtering:** Każdy rekord w bazie wektorowej musi mieć tagi: `talent_id`, `context` (np. 'conflict', 'feedback', 'motivation'), co pozwala na precyzyjne przeszukiwanie (Hybrid Search).