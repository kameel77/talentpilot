# DEVLOG — TalentPilot

> Dziennik decyzji i istotnych zmian. Wpisy od najnowszych.
> Uwaga: docelowe miejsce devloga to vault (`/documents/vault/`) przez skill `/devlog-vault` — w tej sesji niedostępny (folder niepodmontowany), stąd wpis w repo. Do scalenia z vaultem przy okazji.

## 2026-08-07 — Account model (personal → organization) & working share links (Brief #2)

### Decyzje architektoniczne & UX:
1. **Model konta osobistego (Personal Workspace):** Samosłużebna rejestracja na `/register` (rola `personal` / „Dla siebie i swojego zespołu”) tworzy Konto Osobiste (`is_workspace=True`, `name_confirmed=False`, domyślna nazwa `"{full_name} — Moje konto"` z pełnymi uprawnieniami `role=UserRole.ADMIN`).
2. **Momenty konwersji (Upgrade Moment):** Usunięto baner z pulpitu oraz miękkie ostrzeżenie. Wdrożono dedykowany endpoint `POST /api/organizations/{id}/upgrade` oraz wielokrotnego użytku modal `UpgradeWorkspaceModal.tsx`. Modal przechwytuje akcje tworzenia pierwszego zespołu lub wysyłki pierwszego zaproszenia, pyta o właściwą nazwę firmy i płynnie realizuje akcję bez konieczności ponownego klikania. Próba podniesienia workspace'u Coacha zwraca `403 Forbidden`.
3. **Publiczne linki dla klientów Ghost (Share Links Fix):**
   - Podczas tworzenia konta Ghost generowany jest unikalny 32-znakowy `public_token` (`create_ghost_invite`).
   - Wdrożono migrację uzupełniającą `q2r3s4t5u6v7_backfill_user_public_tokens.py` przydzielającą tokeny dotychczasowym profilom ghost.
   - Endpoint publiczny `/api/public/{slug_or_token}` rozwiązuje dane wizytówki również dla kont z `is_ghost=True`.
4. **Granica dostępu publicznego (Exposure Boundary):** Profil klienta ghost jest dostępny dla każdego posiadacza unikalnego 32-znakowego tokena URL. Dostęp ograniczony jest wyłącznie do pól włączonych w `public_profile_settings`. Adres e-mail pozostaje zablokowany/zamaskowany (`isPlaceholderEmail`), brak dostępu do logowania, danych organizacji czy list użytkowników.
5. **Czystość architektury (Layering Cleanup):** Przeniesiono `is_placeholder_email`, `PLACEHOLDER_EMAIL_DOMAIN` i `compute_invitation_status` do dedykowanego modułu `backend/utils.py`, usuwając lokalne importy routerów w serwisach.
6. **Refaktoryzacja & Porządki:**
   - **Guard upgrade'u:** Poprawiono sprawdzanie `coach_owner` na podstawie roli właściciela/użytkowników w organizacji (`User.role == UserRole.COACH`), dzięki czemu test `test_upgrade_coach_workspace_forbidden` weryfikuje właściwą logikę biznesową przy wywołaniu przez Admina.
   - **i18n & Etykiety:** Usunięto nieużywane klucze `roleCompany*`. Zaktualizowano etykietę w `UpgradeWorkspaceModal` (`nameLabel`) oraz podpięto `useRoleLabels()` (`inviteLabel`) i tłumaczony `t("newTeam")` na stronie `users/page.tsx`.
   - **Downgrade migracji & Stub:** Doprecyzowano `sa.String(64)` w stubie tabeli migracji `q2r3s4t5u6v7` oraz zapisano w kodzie `downgrade()`, że `pass` jest celowym wyborem (bezinwazyjne zachowanie wygenerowanych tokenów). Usunięto martwą ścieżkę modalu ze szczegółów zespołu (`teams/[id]/page.tsx`).

---

## 2026-08-06 — Coach signup & onboarding rework

### Decyzje architektoniczne & UX:
1. **Org name deferred post-signup:** Wycofano wymagane pole `organization_name` z formularza rejestracji (`/register`). Dla organizacji firmowych nazwa jest nadawana z domyślnym szablonem i flagą `name_confirmed=False`. Wdrożono baner z opcją edycji nazwy na `/dashboard` oraz ostrzeżenie przed wysyłką zaproszeń e-mail w modalach zespołów.
2. **Dwustopniowa rejestracja z wyborem roli (`/register`):** Strona `/register` zawiera wybór roli („Dla każdego / Dla siebie” vs „Jestem coachem”). Przekierowanie ze starej ścieżki `/register/coach` na `/register?role=coach`.
3. **Ghost invite bez wymaganego e-maila & syntetyczne adresy placeholder:** Zaimplementowano ujednoliconą funkcję `is_placeholder_email` (backend & frontend parsing domeny `placeholder.talentpilot.local`). Mechanizm wysyłkowy (`send_invitation_email` / `resend_invitation`) blokuje wysyłkę na te adresy (HTTP 400 "User has no email address"). Na frontendzie syntetyczne adresy są maskowane (`—`).
4. **Ukrycie pól stanowiska dla Coachów:** Ukryto pola `Stanowisko (PL/EN)` w ustawieniach konta oraz profilu publicznym `/aboutme/[token]` dla roli Coach.
5. **Kreator coacha (PDF-first + Bulk Drop + Link do profilu + Tłumaczone talenty):** Kreator wspiera bezpośrednie odczytywanie raportów PDF (z przetłumaczonym podglądem Top 5 talentów PL/EN i auto-wypełnieniem nazwisk), masowy upload wielu plików PDF na raz z przyciskiem kopiowania profilu (E1 & E4), wskaźnik postępu i pełne i18n (E2) oraz podpięcie `useRoleLabels` (E3). `GhostInviteResponse` zwraca `public_token` i `public_slug`.

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
