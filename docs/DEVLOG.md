# DEVLOG — TalentPilot

> Dziennik decyzji i istotnych zmian. Wpisy od najnowszych.
> Uwaga: docelowe miejsce devloga to vault (`/documents/vault/`) przez skill `/devlog-vault` — w tej sesji niedostępny (folder niepodmontowany), stąd wpis w repo. Do scalenia z vaultem przy okazji.

## 2026-10-31 — „Mój profil coacha” i podpis coacha na materiałach klientów (Brief #4, A + B)

### Decyzje
1. **„Moje talenty” → „Mój profil coacha” (A).** Usunięto przekierowanie coacha z `/dashboard/my-talents` (bug: link w menu przywrócony 2026-08-10, przekierowanie z 2026-07-03 zostało). Coach widzi swoje talenty, instrukcję obsługi i kartę „Twój podpis na materiałach klientów”: podgląd 1:1 z tym, co widzi klient, lista braków (certyfikat, kontakt, zdjęcie, talenty) i przełącznik podpisu. Na liście „Pierwsze kroki” jest nowy krok 2 „Uzupełnij swój profil coacha” (`first_steps.coach_has_talents`).
2. **Podpis coacha (B).** `services/coach_signature.py` wyznacza coacha klienta (właściciel workspace'u dla klientów indywidualnych, najwcześniej przypisany coach z `OrganizationAccess` dla firm). Podpis pojawia się w dwóch miejscach:
   - `/aboutme/{token}` klienta: pełna karta „Profil przygotował(a)” z certyfikatem, kontaktem i linkiem do wizytówki coacha;
   - `/presentation/{token}`: wersja minimalna (imię, certyfikat, link do wizytówki), bo endpoint prezentacji ma kontrakt zero-PII (test sprawdza brak „email”/„@”).
3. **Prywatność:** podpis pokazuje tylko to, co coach odsłania na własnej wizytówce (`show_photo/email/phone/certification`). Przełącznik `public_profile_settings.show_coach_signature` jest domyślnie włączony, bez migracji (JSON). Coach nie podpisuje własnej wizytówki. Adresy placeholder nigdy nie wychodzą. Linki od użytkownika (LinkedIn, Gallup) renderowane są tylko jako http(s).
4. **Domyślnie włączony i darmowy.** To decyzja produktowa do potwierdzenia: podpis jest kanałem dystrybucji, więc w planie Free warto rozważyć stopkę „powered by TalentPilot”, a w Pro pełny branding coacha (logo, kolory). Dziś bez ograniczeń planu.

### Naprawione przy okazji (blokowało B i P2)
- **Prezentacja zespołu była pusta dla zespołów zaimportowanych przez coacha.** Osoby dodane z PDF to profile ghost (`is_active=False`), a endpoint prezentacji przepuszczał tylko `is_active`. Teraz reguła jest taka jak dla wizytówek: `is_active OR is_ghost`; dezaktywowane konta nadal ukryte. Test regresji w `test_coach_signature.py`.
- `/aboutme` pobiera dane z `cache: "no-store"`, żeby zmiany prywatności i podpisu były widoczne po odświeżeniu (wykryte w E2E).
- Ustawienia wizytówki zachowują `show_coach_signature` przy zapisie innych przełączników.

### Weryfikacja
- Backend: `pytest tests` → 205 passed, 3 skipped (+6 testów w `test_coach_signature.py`: podpis dla klienta indywidualnego i firmowego, prywatność i opt-out, brak podpisu na własnej wizytówce i w organizacji bez coacha, prezentacja bez PII, profile ghost w prezentacji).
- Frontend: lint (te same 7 ostrzeżeń co wcześniej), `tsc`, build, parytet PL/EN.
- E2E (Chromium, lokalny backend): krok profilu na liście → „Mój profil coacha” bez przekierowania → braki 4 → 1 po uzupełnieniu → wizytówka klienta z podpisem, certyfikatem i telefonem → link do wizytówki coacha (200, bez autopodpisu) → prezentacja z podpisem i bez „@”/„email” w API → wyłączenie podpisu ukrywa go u klienta.

### Następne
- C (dopasowanie coach–klient w porównaniu i AI) odłożone na później, razem z dopracowaniem Asystenta AI.

---

## 2026-10-31 — „Pierwsze kroki” coacha (Brief #4, P2)

### Decyzje
1. **Lista kroków na pulpicie coacha, odhaczana z danych:** dodaj klienta → wyślij link do profilu → przygotuj prezentację zespołu. Znika po ukończeniu lub po „Ukryj”.
   - **Asystent AI celowo poza onboardingiem** (decyzja Kamila): najpierw dopracujemy jego działanie. Backend nadal zwraca `qa_queries`, więc krok wróci bez zmian API.
2. **Fakty z backendu zamiast deklaracji:** `coach-overview` zwraca `first_steps { presentation_links, qa_queries, suggested_team }`. Prezentacja = istniejący `presentation_token` na zespole klienta, AI = `UserQuery` coacha, `suggested_team` = największy zespół klienta (cel CTA). Bez migracji.
3. **Sygnały tylko z przeglądarki (skopiowany link, ukrycie listy) w localStorage**, per użytkownik, przez `lib/firstSteps.ts` (`useSyncExternalStore`, odświeżanie na żywo). Świadomy dług: do zastąpienia zdarzeniami analitycznymi w P4. Ryzyko: inny komputer = krok „link” nieodhaczony.
4. **Tryb prezentacji wyciągnięty na wierzch:** `?presentation=1` na stronie zespołu otwiera modal linku. Prowadzi tam lista i ekran „Co dalej?” w przepływie „Dodaj klienta” (dla firmy z osobami).
5. **Krok „Twój profil” pominięty celowo.** `/dashboard/my-talents` przekierowuje coacha na pulpit (dodane 2026-07-03), mimo że link w menu przywrócono 2026-08-10 („restore coach access”). Naprawa była niepełna, czyli to bug. Decyzja o roli tej zakładki dla coacha czeka na Kamila.

### Weryfikacja
- Backend: `pytest tests` → 199 passed, 3 skipped (+2 nowe testy `first_steps`, w tym brak wycieku zespołów z cudzych organizacji).
- Frontend: lint bez nowych ostrzeżeń, `tsc` czysty, `npm run build` OK, parytet kluczy PL/EN.
- E2E (Chromium, lokalny backend SQLite, parsowanie PDF zamockowane): nowy coach 0/4 → firma z checklisty → „Co dalej?” → strona zespołu z otwartym modalem → link wygenerowany → 2/4 → osoba + skopiowany link → 3/4 na żywo → zapytanie AI → lista znika; „Ukryj” przetrwa przeładowanie; widok 390 px.

---

## 2026-10-31 — „Dodaj klienta” dla coacha (Brief #4, P1)

### Problem
Po pierwszym kliencie coach tracił prowadzenie: klienta indywidualnego nie dało się dodać poza kreatorem (brak przycisku w zakładce „Indywidualni”, kreator jednorazowy, `/dashboard/users` poza nawigacją coacha), a drugi klient firmowy wymagał 4 ekranów w 3 kontekstach. Szczegóły i P2–P4: `docs/BRIEF_COACH_CLIENT_FLOW.md`.

### Decyzje
1. **Jeden przepływ, dwie powłoki.** `components/clients/add-client/AddClientFlow.tsx` (osoba / firma) używany w dialogu (pulpit coacha, lista klientów, puste stany) i w kreatorze onboardingu (`CoachWizard` = nagłówek powitalny + ten sam przepływ + „Pomiń”). Zachowane wznawianie onboardingu (firma bez zespołu / pusty zespół).
2. **Firma = nazwa + pierwszy zespół na jednym ekranie** (domyślnie „Zespół główny”). NIP i adres nie są pytane przy tworzeniu — coach fakturuje poza aplikacją; pola zostają w „Edytuj dane firmy”.
3. **Stały licznik kroków** (osoba 3, firma 4), „Wstecz” do momentu zapisania czegokolwiek, potem tylko do przodu (bez duplikatów).
4. **Prawdziwy drag & drop** wielu PDF z listą do przeglądu; błędy per wiersz, ponowienie nie duplikuje profilu (zapamiętany `userId` po udanym `createGhostInvite`). To samo dla pojedynczej osoby.
5. **Limit planu sprawdzany przy wyborze typu klienta** (modal zanim coach cokolwiek wpisze) oraz z realnym N przy imporcie wielu PDF.
6. **Kontekst organizacji zmieniany dopiero przy „Otwórz matrycę”** — wszystkie wywołania API w przepływie mają jawne `team_id` / `organization_id`.
7. **Odświeżanie list bez spinnera** po każdej zmianie (spinner na poziomie strony odmontowałby otwarty dialog).

### Poprawki przy okazji (uzasadnione zakresem)
- Lista klientów indywidualnych pokazywała syntetyczne adresy `ghost+…@placeholder.talentpilot.local` — teraz ukryte (`isPlaceholderEmail`), także w wyszukiwaniu. Problem rósłby wraz z P1 (więcej klientów bez e-maila).
- Nazwy talentów w podglądzie PDF: backendowe `translated_rankings` jest kluczowane nazwą, nie kodem, więc stary kreator nigdy z niego nie korzystał; teraz jawnie `GALLUP_TALENTS` (SSoT). Parsowanie PDF używa języka UI zamiast sztywnego `pl`.
- Usunięto zdublowany baner „Dokończ konfigurację” z pulpitu (dla 0 klientów prowadził do tego samego przepływu co pusty stan) i 48 martwych kluczy `onboarding.coach.*` (PL/EN, parytet kluczy zachowany).

### Weryfikacja
- `npm run lint` — 0 błędów, 7 ostrzeżeń (wszystkie istniały wcześniej); `npm run build` — OK.
- E2E w Chromium na lokalnym backendzie (SQLite + talenty z seeda, parse PDF zamockowany na poziomie przeglądarki — brak prawdziwego raportu Gallupa w sandboxie): rejestracja coacha → firma + 3 PDF (plik .txt odrzucony) → matryca z 3 osobami; pulpit → osoba z PDF → link → publiczna wizytówka 200; zakładka „Indywidualni” bez adresów placeholder; druga firma bez osób z listy klientów; dialog na 375 px.
- Dodatkowo: wersja EN dialogu; plan Free z wygasłym trialem → modal limitu przy wyborze „Firma”, przepływ zostaje na kroku 1.
- Nie sprawdzone: prawdziwy PDF Gallupa przez dialog (ta sama ścieżka API co wcześniej) — do weryfikacji na DEV.

### Dług / następne kroki
- Strona zespołu (`teams/[id]`) ma nadal własny import wielu PDF (dodaje od razu, bez przeglądu) — migracja do `PdfBatchImport` w P3.
- Globalny przełącznik organizacji (P5) zostaje — po „Otwórz matrycę” nagłówek pokazuje klienta, co jest poprawne, ale model „przełączania organizacji” nadal wymaga rewizji.

---

## 2026-08-10 — Trial produktowy, limity Free i UI płatności (Brief #3, faza 2c)

### Decyzje
1. **Trial startuje przy rejestracji, bez karty.** Nowy workspace dostaje `TRIALING` + `trial_ends_at` od razu: **14 dni domyślnie, 30 dla coacha** (`BILLING_TRIAL_DAYS_DEFAULT` / `_COACH`). Wcześniej rejestracja zostawiała `subscription_status=free`, więc przy nowych limitach świeże konto nie mogłoby dodać ani jednej organizacji przed zapłatą.
2. **Karta przy rejestracji jako flaga, nie decyzja w kodzie** — `BILLING_REQUIRE_CARD_AT_SIGNUP` (domyślnie `false`), zwracana do frontendu przez `/api/billing/status`. Pozwala testować lejek bez deployu nowej logiki.
3. **Limity Free: 0 organizacji klienckich, 3 klientów indywidualnych** (było 1 / 5). Organizacje stają się w całości funkcją płatną.
4. **Brak podwójnego triala.** `create_checkout_session` przekazuje Stripe'owi **pozostałe** dni triala produktowego zamiast nowych 14/30; po jego wygaśnięciu checkout obciąża natychmiast. Zamyka lukę „dodaj kartę ostatniego dnia i dostań drugi darmowy okres".
5. **Jedno źródło prawdy o trialu** — `services/billing/trial.py` (`start_trial`, `is_trial_active`, `remaining_trial_days`). `plan_limits.py` i `webhook_handler.py` korzystają z niego zamiast własnych kopii; usunięto stałą `TRIAL_DAYS = 14` na rzecz konfiguracji.
6. **Kwoty nadal nie istnieją w repo.** Nowy `GET /api/billing/status` zwraca katalog planów z cenami odczytanymi ze Stripe (`list_prices`, cache 10 min), status subskrypcji, licznik triala i flagę karty. Odpowiada też przy `BILLING_PROVIDER=disabled` — trial jest nasz, nie dostawcy — a `enabled=false` mówi UI, żeby ukryć checkout zamiast oferować przyciski zwracające 503.
7. **Paywall: cennik w Rozliczeniach + przechwyt 402.** Interceptor w `lib/api.ts` rozgłasza `plan_limit_exceeded` jako zdarzenie okna; jeden `BillingNotices` w layoucie dashboardu pokazuje modal z konkretnym limitem, baner końca triala, baner `past_due` i wynik powrotu z Checkoutu (`?checkout=success|cancelled`).

### Zmiany techniczne
- Backend: `services/billing/trial.py` (nowy), `base.PlanPrice` + `list_prices()` (domyślnie pusta lista), `GET /api/billing/status`, `BillingStatusResponse`, trial w obu ścieżkach rejestracji.
- Frontend: `components/billing/{PlanPicker,BillingNotices}.tsx`, `api.billing.status()`, `checkout(plan, interval)`, typy `BillingStatus` / `PlanLimitExceeded`.
- Testy: nowy `tests/test_billing_status.py` (6 przypadków) + aktualizacja `test_plan_limits`, `test_billing_webhook`, `test_stripe_provider` do nowego modelu. `176 passed`; jedyna porażka (`test_gallup_api::test_parse_pdf_unauthorized`) jest wcześniejsza niż te zmiany — potwierdzone na worktree z HEAD.
- Dokumentacja: `docs/BILLING_STRIPE_SETUP.md` — webhooki dla staginga (test) i produkcji (live), komplet zmiennych, kolejność wdrożenia i checklista weryfikacyjna. `.env.example` uzupełniony o sekcję billingu.

### Nie zrobione
Fakturownia/KSeF (świadomie odłożone). Przeterminowany trial traci limity natychmiast, ale `subscription_status` zostaje `trialing` do czasu webhooka — kosmetyka statusu, nie luka w limitach.

---

## 2026-08-10 — Przebudowa ustawień: 4 zakładki zamiast jednego ekranu

### Problem
`/dashboard/settings` był jedną stroną (1377 linii, 11 kart w siatce, bez nawigacji). Pięć niezależnych przycisków „Zapisz" z osobnymi komunikatami inline (w karcie wizytówki dwa naraz), duplikacja edycji talentów i instrukcji obsługi z `/dashboard/my-talents`, cztery karty bez backendu (powiadomienia, zarządzanie zespołem z zahardkodowanymi liczbami, 2FA/eksport, rozszerzenia) oraz bug: karta talentów startowała z `myTalents = []` i nigdy nie czytała z API, więc każdy widział „Brak zaimportowanych talentów".

### Decyzje UX
1. **Podział na 4 route'y** (`settings/account`, `billing`, `public-profile`, `organization`) + `settings/layout.tsx` z nawigacją: lewy rail na desktopie, przewijalne taby na mobile. `/dashboard/settings` przekierowuje na `account`.
2. **Jeden zapis na zakładkę.** Sticky `UnsavedBar` pojawia się tylko przy dirty state (hook `useFormState` z baseline). Zmiana hasła zachowuje własny przycisk — to akcja, nie stan ustawień.
3. **Przełączniki zapisują się natychmiast** (`ToggleRow`, optymistycznie z rollbackiem). Mieszanie switchy z przyciskiem „Zapisz" było głównym źródłem nieporozumień.
4. **Komunikaty przez toast** (`components/ui/toast.tsx`, własny, bez nowej zależności) zamiast pięciu kolorowych `<p>` rozsianych po ekranie.
5. **Rozdzielenie treści od udostępniania.** Talenty i instrukcja obsługi zostają wyłącznie w `/dashboard/my-talents`; zakładka wizytówki odpowiada tylko za adres, widoczność pól i **podgląd na żywo** (iframe publicznej wizytówki). Cross-linki w obie strony.
6. **Ukrywanie zamiast blokowania.** Zakładka „Rozliczenia" widoczna wyłącznie dla `admin`/`manager`/`coach` (zgodnie z `require_role` na `PATCH /api/organizations/{id}`); członek bez uprawnień dostaje czytelne podsumowanie organizacji (`<dl>`), a nie formularz z `disabled`.
7. **Usunięto atrapy.** Powiadomienia, zarządzanie zespołem, 2FA/eksport i rozszerzenia zniknęły. Liczby ról w organizacji liczone realnie z `api.users.list()`.
8. **Rozliczenia bez Stripe.** Zakładka pokazuje realny `plan` / `subscription_status` / `trial_ends_at` (już zwracane przez `OrganizationResponse`) oraz edytowalne dane nabywcy z NIP-em — NIP przeniesiony z „Organizacji", bo tam się go szuka. Sekcja karty i faktur to jawny komunikat „wkrótce", bez klikalnych atrap. Zgodne z `docs/BRIEF_BILLING_TRIAL.md`.
9. **Aktywna organizacja.** Zakładki czytają `tokenManager.getActiveOrgId() ?? user.organization_id` — wcześniej ustawienia zawsze edytowały macierzystą organizację użytkownika, ignorując przełącznik org w layoucie.

### Zmiany techniczne
- Nowe: `hooks/useFormState.ts`, `components/ui/toast.tsx`, `components/settings/{SettingsNav,SettingsCard,UnsavedBar,ToggleRow}.tsx`.
- `lib/api.ts`: dodano typ `PublicProfileSettings` i podpięto go do `User.public_profile_settings` oraz `UserUpdateData` (usuwa rzutowania w komponentach).
- Usunięto nieużywany już `components/dashboard/SettingsSection.tsx` (zastąpiony przez `SettingsCard`).
- Dług: teksty zakładek pozostają zahardkodowane po polsku (tak jak w poprzedniej wersji ekranu) — migracja do `messages/*.json` osobno.

---

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
