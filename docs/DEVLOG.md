# DEVLOG — TalentPilot

> Dziennik decyzji i istotnych zmian. Wpisy od najnowszych.
> Uwaga: docelowe miejsce devloga to vault (`/documents/vault/`) przez skill `/devlog-vault` — w tej sesji niedostępny (folder niepodmontowany), stąd wpis w repo. Do scalenia z vaultem przy okazji.

---

## 2026-07-19 — Strategia komercjalizacji + streaming SSE (QA i Tips) + UX

### Strategia
- Powstała analiza komercjalizacji wśród coachów: `docs/COMMERCIALIZATION_STRATEGY.md`.
- Kluczowe decyzje: model etapowy (Etap 1: coach-jako-klient, Etap 2: coach-jako-kanał z rev-share); rynek startowy PL; founder-led sales przez własną praktykę coachingową.
- **Ryzyko krytyczne zidentyfikowane: IP Gallupa** (znaki towarowe 34 talentów, zakaz aplikacji na frameworku bez zgody; precedens — Gallup kupił Cascade w 2022). Bramka przed monetyzacją: audyt IP treści (autorskie opisy zamiast kopii), disclaimery, konsultacja prawna.
- Priorytety przedkomercyjne: billing (Stripe) → streaming SSE (✅ zrobione) → eksport PDF → higiena IP.
- Cel 90 dni: 10 płacących coachów (~250 zł/mies.), 5–8 design partnerów.

### Streaming SSE (commit e72bd47 + 963fe62)
- Protokół SSE: `meta` → `delta`* → `done` | `error`; wspólny helper `services/sse.py` (backend) i `sseRequest()` w `lib/api.ts` (frontend).
- QA: `POST /v1/qa/query/stream`; Tips: `GET /tips/daily/stream`, `GET /tips/synergy/{id}/stream`.
- Decyzja architektoniczna: generator SSE nie używa sesji request-scoped — zapis wyniku (`GeneratedAnswer`/`AITip`) na świeżej `SessionLocal` po zakończeniu streamu (odporność na zamknięcie sesji w trakcie `StreamingResponse`).
- Decyzja UX: w Mostach dane deterministyczne (synergy score, wspólne talenty, domain balance) idą w evencie `meta` natychmiast — AI dopisuje się na żywo.
- Decyzja: toggle `qa_streaming_enabled` (app_settings, default true) obowiązuje QA i Tips; wyłączony = ten sam protokół, jedna delta (frontend ma jedną ścieżkę kodu). Fallback do endpointów non-stream przy błędzie transportu.
- Refaktor `tips_service`: buildery `prepare_daily_tip` / `prepare_synergy_tip` współdzielone przez ścieżkę sync i SSE; `save_tip()` przyjmuje dowolną sesję.
- Ryzyko produkcyjne do weryfikacji: buforowanie SSE przez proxy (Coolify/nginx) — dodany nagłówek `X-Accel-Buffering: no`.

### UX (commit 963fe62)
- Wyszukiwarka na `/organizations`: filtruje organizacje (nazwa, miasto, NIP) i klientów indywidualnych (imię, e-mail); i18n PL/EN.
- Ujednolicona pełna szerokość layoutu (usunięte `max-w-5xl/7xl`): dashboard, qa, tips, compare, my-talents, settings — spójnie z `/teams/[id]`.

### Decyzja: slug dla teams — ODŁOŻONE
- Numeryczne ID w URL nie jest luką (RBAC + separacja per org); slug to koszt średni (migracja, unikalność per org, zmiany nazw) przy wartości kosmetycznej.
- Rewizja: przy wdrażaniu publicznego udostępniania zespołów — wtedy nieodgadywalny token (wzorzec `public_token`/`public_slug` z profili), nie ładny slug.

### Infrastruktura / proces
- Środowisko sandbox nie ma poświadczeń GitHub; skonfigurowano repo-lokalny `credential.helper store --file=.git/gh-credentials` — token trzeba umieścić w `.git/gh-credentials` (poza repo), wtedy push działa z sesji.
- Dwukrotnie osierocone locki gita (`index.lock`, `refs/.../main.lock`) po przerwanych operacjach na współdzielonym mouncie — objaw znany, rozwiązanie: usunięcie locka.
- Commity: `e72bd47` (SSE QA), `70507ac` (strategia), `963fe62` (SSE Tips + search + full-width; do wypchnięcia).

### Następne kroki
1. Push `963fe62` (czeka na token w `.git/gh-credentials`).
2. Test streamingu na produkcji (realny klucz OpenRouter, weryfikacja proxy).
3. Start planu 90 dni: audyt IP treści Knowledge Base + billing Stripe.
