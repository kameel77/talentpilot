# Publiczny link do matrycy talentów zespołu

Data: 2026-09-15
Status: zatwierdzony do implementacji

## Cel

Osoba zarządzająca zespołem (admin / manager / coach) generuje link, który
pozwala obejrzeć matrycę talentów zespołu **bez logowania** — na spotkaniu
z klientem, na warsztacie, w mailu do zarządu. Odpowiednik przycisku
„Prezentacja wyników" z aplikacji `talentpilot-team`.

## Stan wyjściowy

Funkcja jest w repozytorium zescaffoldowana w ~70%, ale martwa:

| Element | Stan |
|---|---|
| `Team.presentation_token` — `models.py:215` | istnieje, migracja `dd87278924a7` wdrożona na produkcji |
| `GET /api/public/presentations/{token}` — `routers/public.py:141` | **rzuca `NameError`** — odwołuje się do klasy `TeamMember`, która nie istnieje ani w imporcie, ani w `models.py` |
| `frontend/app/presentation/[token]/page.tsx` | istnieje, leży poza grupą `(dashboard)`, więc już dziś omija client-side guard |
| `components/PresentationContent.tsx` | 761 linii, fork `MatrixDashboard` z hardkodowanymi polskimi tekstami |
| `api.public.getPresentation` — `lib/api.ts:1124` | istnieje |
| Endpoint generujący token | **brak** |
| Przycisk w panelu zespołu | **brak** |

Przyczyna błędu: `public.py` został przeniesiony z `talentpilot-team`, gdzie
członkostwo w zespole było osobnym pivot-encją `TeamMember` z własnymi polami.
W `talentpilot` członkostwo to relacja many-to-many przez tabelę `user_teams`
(`models.py:227`), a rola i flaga lidera liczone są inaczej —
poprawny wzorzec iteracji jest w `routers/teams.py:264-294`.

Alembic ma **jedną głowę**: `y4z5a6b7c8d9`. Merge migration nie jest potrzebny.

## Czego świadomie nie kopiujemy z `talentpilot-team`

Tamta implementacja ma trzy wady, które tutaj są naprawiane:

1. **Wyciek danych osobowych.** `GET /api/presentations/[token]` używa Prisma
   `include` bez `select` i publicznie, bez logowania, zwraca pełne rekordy:
   e-maile wszystkich członków, nazwę, adres i **NIP organizacji**. UI ich nie
   renderuje, ale `curl` i zakładka Network w DevTools — tak.
2. **Brak kontroli dostępu do zespołu.** `POST /api/teams/[id]/presentation-token`
   sprawdza wyłącznie, czy request ma ważny JWT — nie sprawdza, czy zespół
   należy do organizacji wołającego. Dowolny zalogowany admin może wygenerować
   publiczny link do **cudzego** zespołu.
3. **Brak rewokacji.** Jedyny endpoint to `POST` (generuj-lub-zwróć-istniejący).
   Raz wypuszczonego linku nie da się unieważnić inaczej niż ręcznym `UPDATE`
   w bazie.

## Decyzje architektoniczne

**Token jako kolumny na `Team`**, nie osobny model `TeamShareLink`.
Jeden link na zespół, rotacja przez nadpisanie. Model `TeamShareLink`
(wiele linków, każdy z własnym trybem i licznikiem wejść) jest naturalną
ścieżką rozbudowy, ale dziś nie ma sygnału, że ktokolwiek potrzebuje dwóch
równoległych linków do jednego zespołu. Publiczny endpoint przyjmuje token
nieprzezroczysty, więc późniejsza podmiana źródła tokenu z kolumny na tabelę
nie złamie ani istniejących linków, ani kontraktu API.

**Anonimizacja liczona na serwerze.** Filtrowanie w UI nie jest anonimizacją —
`curl` je omija. Backend zwraca gotowe `display_name`.

**Brak wygasania linku (`expires_at`).** Rewokacja pokrywa potrzebę
odebrania dostępu; datę ważności można dodać później bez zmiany kontraktu.

**Brak bramki billingowej.** Udostępnianie jest dostępne na każdym planie.
Dodanie limitu planowego później jest łatwe; odebranie działającej funkcji
użytkownikom — nie.

**Analiza ryzyk niedostępna publicznie.** `canSeeRisks={false}` — SPOF, słabe
punkty zespołu i odporność to materiał wewnętrzny.

## Backend

### Model i migracja

```
Team:
  presentation_token        String(64), unique, index, nullable   # JUŻ ISTNIEJE
  presentation_anonymized   Boolean, not null, default False      # nowe
  presentation_created_at   DateTime, nullable                    # nowe
```

Jedna migracja Alembica, `down_revision = 'y4z5a6b7c8d9'`.
`presentation_created_at` służy audytowi („kiedy ten link powstał") i jest
pokazywane w modalu.

### Endpointy zarządzania linkiem — `routers/teams.py`

Wszystkie trzy: `Depends(require_role(["admin", "manager", "coach"]))`
plus **ten sam check organizacji, co `get_team_matrix`** —
`_accessible_org_ids(db, current_user)`, `403` gdy `team.organization_id`
spoza zbioru (`teams.py:254-260`). To jest naprawa wady nr 2 powyżej i musi
być pokryte testem.

| Metoda | Ścieżka | Zachowanie |
|---|---|---|
| `GET` | `/api/teams/{team_id}/presentation-link` | Zwraca `{token, url, anonymized, created_at}` lub `{token: null}` |
| `POST` | `/api/teams/{team_id}/presentation-link` | Body `{anonymized: bool}`. Tworzy **lub rotuje** token, ustawia `presentation_created_at = now()`. Rotacja unieważnia poprzedni link. |
| `PATCH` | `/api/teams/{team_id}/presentation-link` | Body `{anonymized: bool}`. Zmienia **wyłącznie tryb anonimizacji**, token i `created_at` bez zmian. `404` gdy linku nie ma. |
| `DELETE` | `/api/teams/{team_id}/presentation-link` | `presentation_token = NULL`, `presentation_created_at = NULL`. `204`. |

Token: `secrets.token_urlsafe(32)`.

Rozdzielenie `POST` i `PATCH` jest celowe. Przełącznik „Ukryj nazwiska"
w modalu wywołuje `PATCH` i **nie unieważnia** linku — raz wysłany klientowi
adres działa dalej, zmienia się tylko to, co pod nim widać. Rotacja jest
osobną, jawną akcją użytkownika (`POST`, przycisk „Wygeneruj nowy link").

Konsekwencja do zaakceptowania: odbiorca, który dostał link nieanonimowy
i zapisał go sobie, po przełączeniu zobaczy wersję anonimową — ale widział
już nazwiska. `PATCH` chroni przed przyszłym ujawnieniem, nie cofa
przeszłego. Kto chce odciąć dotychczasowych odbiorców, używa rotacji
albo unieważnienia.

### Nowe schematy publiczne — `schemas.py`

Istniejący `PresentationMember` (`schemas.py:882-891`) niesie `email`,
`is_ghost`, `invited_at`, `invitation_status` i jest współdzielony
z prywatnym `GET /api/teams/{id}/matrix`. **Nie wolno go reużyć publicznie** —
to odtworzyłoby dokładnie wyciek nr 1. Osobna rodzina schematów:

```python
class PublicPresentationTalent(BaseModel):
    rank: int
    talent: str      # kod, np. "achiever"
    domain: str      # "executing" | ...

class PublicPresentationMember(BaseModel):
    display_name: str          # "Kalina Mitraszewska" albo "Osoba 1"
    is_leader: bool
    results: list[PublicPresentationTalent]

class PublicPresentationResponse(BaseModel):
    team_name: str
    organization_name: str | None       # None gdy anonymized
    anonymized: bool
    members: list[PublicPresentationMember]
    talents: list[TalentResponse]       # reużyty istniejący schemat
```

Brak `id` członka, `email`, `role`, `is_ghost`, `invited_at`,
`invitation_status`, NIP-u i adresu organizacji.

`TalentResponse` (`schemas.py:355`) jest reużyty bez zmian — zawiera wyłącznie
`id`, `code`, `domain` i tłumaczenie, więc nie niesie żadnych danych wrażliwych,
i jest dokładnie tym kształtem, którego oczekuje frontowy typ `Talent`
(`lib/api.ts:144-149`).

`talents` jedzie w tym samym payloadzie, bo `api.talents.list()` jest za JWT,
a nazwy talentów muszą pochodzić z backendu jako źródła prawdy — publiczna
strona nie może ich brać z frontowego słownika.

### Naprawa `GET /api/public/presentations/{token}`

Sygnatura: `get_presentation(token: str, lang: str = "pl", db = Depends(get_db))`.

`lang` jest konieczny, bo `Talent.translation` rozwiązywany jest per-język,
a publiczny request nie ma zalogowanego użytkownika, z którego dałoby się
odczytać język. Frontend przekazuje wynik `getLocaleFromCookie()`.
Wartości spoza `{"pl", "en"}` degradują się do `"pl"`.

Logika:

1. `team = db.query(Team).filter(Team.presentation_token == token).first()`;
   `404` gdy brak (obejmuje też token unieważniony — `NULL != token`).
2. Iteracja po `team.members` (relacja m2m), dokładnie jak
   `teams.py:264-294`. Usunąć wszystkie odwołania do `TeamMember`,
   `member.user_id` i `member.role`.
3. Pomijać członków bez talentów oraz nieaktywnych (`is_active == False`).
4. `is_leader = (team.manager_id == member.id)`.
5. Gdy `team.presentation_anonymized`:
   - `display_name = f"Osoba {i}"`, gdzie `i` z numeracji po **posortowanych
     rosnąco `member.id`** — nie po nazwisku. Sortowanie alfabetyczne
     zdradzałoby pierwszą literę nazwiska i przy małym zespole pozwalało
     deanonimizować wiersze.
   - `organization_name = None`.
   - `is_leader` pozostaje — to informacja o strukturze, nie o tożsamości.
6. Gdy nie: `display_name = member.full_name`,
   `organization_name = team.organization.name`.
7. Odpowiedź z nagłówkiem `X-Robots-Tag: noindex, nofollow`.

### Rate limiting

W repozytorium nie ma dziś żadnej infrastruktury limitowania ani Redisa,
a produkcja to pojedynczy proces uvicorn (`backend/Dockerfile:16`).

Lekki limiter in-process (słownik IP → okno przesuwne, ~30 linii, zero nowych
zależności) jako dependency **na całym routerze `/api/public`** — obejmuje
zarówno prezentacje zespołów, jak i istniejące publiczne wizytówki
użytkowników. Limit: **30 żądań / minutę / IP**, odpowiedź `429` z `Retry-After`.

**Identyfikacja klienta za reverse proxy.** Produkcja stoi za Traefikiem
(Coolify) i Cloudflare, więc `request.client.host` to adres proxy — bez
obsługi nagłówków jeden IP Traefika wyczerpałby limit dla wszystkich.
Kolejność odczytu:

1. `CF-Connecting-IP` — Cloudflare **nadpisuje** ten nagłówek, więc klient
   go nie podrobi.
2. **Ostatni** element `X-Forwarded-For` — nie pierwszy. Traefik *dopisuje*
   do listy, więc przy żądaniu z podrobionym `X-Forwarded-For: 1.2.3.4`
   nagłówek ma postać `1.2.3.4, <prawdziwy_IP>`; wzięcie elementu `[0]`
   oddałoby atakującemu pełną kontrolę nad kluczem limitu i pozwoliło
   omijać go w nieskończoność przez losowanie wartości.
3. `request.client.host`.

Słownik musi czyścić klucze, których wszystkie znaczniki czasu wypadły
poza okno — inaczej rośnie w nieskończoność przy ruchu z wielu IP.
Limiter wystawia `reset_rate_limiter()` na potrzeby testów.

`slowapi` + Redis dokładamy dopiero, gdy backend pójdzie w wiele replik —
przy jednym procesie byłaby to zależność bez zysku.

## Frontend

### Strona publiczna

`app/presentation/[token]/page.tsx` zostaje na miejscu — jest poza grupą
`(dashboard)`, więc nie przechodzi przez guard JWT z `(dashboard)/layout.tsx:63-68`.

Zmiany:
- `metadata` → `robots: { index: false, follow: false }`, tytuł z i18n
  zamiast hardkodowanego „Wizytówka Zespołu".
- Renderuje `MatrixDashboard` zamiast `PresentationContent`.

Reużycie `MatrixDashboard` jest wykonalne, bo:
- komponent jest czysto prezentacyjny — przyjmuje `{members, canSeeRisks, talents}`
  przez propsy i nie ma w środku żadnego fetcha ani odwołania do auth
  (`MatrixDashboard.tsx:39-45`);
- `NextIntlClientProvider` jest w **root** layoucie (`app/layout.tsx:47`),
  a nie w `(dashboard)` — więc `useTranslations` działa również na stronie
  publicznej i i18n dostajemy bez dodatkowej pracy.

Nowy, cienki `PublicPresentation.tsx`: fetch → stany loading / 404 / 429 →

```tsx
<MatrixDashboard members={members} talents={talents} canSeeRisks={false} />
```

`components/PresentationContent.tsx` (761 linii) zostaje **usunięty**.

### Mapowanie danych

Publiczna odpowiedź mapowana na propsy `MatrixDashboard`:
`display_name` → `Member.name`, `results` bez zmian. Pole `Member.id`
wypełniane indeksem — `MatrixDashboard` używa go tylko jako klucza Reacta,
a publiczne API celowo nie wystawia identyfikatorów użytkowników.

### Panel zespołu

Przycisk „Prezentacja wyników" w
`app/(dashboard)/dashboard/teams/[id]/page.tsx`, obok istniejących akcji,
widoczny dla admin / manager / coach.

Nie kopiujemy zachowania z `talentpilot-team`, gdzie kliknięcie od razu
otwiera nową kartę, a link trzeba ręcznie przepisać z paska adresu.
Zamiast tego modal:

- URL w polu read-only + przycisk **Kopiuj do schowka** z potwierdzeniem,
- przełącznik **Ukryj nazwiska** (`anonymized`) — `PATCH`, natychmiastowy,
  bez potwierdzenia i bez unieważniania linku,
- **Wygeneruj nowy link** (`POST`) — osobny przycisk, z potwierdzeniem,
  że dotychczasowy adres przestanie działać,
- **Otwórz podgląd** (nowa karta),
- **Unieważnij link** z potwierdzeniem,
- data utworzenia linku,
- ostrzeżenie, że każdy, kto ma link, widzi dane bez logowania.

Stan pusty (brak tokenu): jeden przycisk **Wygeneruj link** + przełącznik
anonimizacji przed wygenerowaniem.

### Warstwa API

`lib/api.ts`:
- `api.public.getPresentation(token, lang)` — dodany parametr `lang`,
- nowe `api.teams.getPresentationLink(id)`,
  `api.teams.createPresentationLink(id, anonymized)`,
  `api.teams.updatePresentationLink(id, anonymized)`,
  `api.teams.deletePresentationLink(id)`.

Uwaga: globalny interceptor `apiClient` dokleja `Authorization: Bearer`,
gdy token istnieje w `tokenManager` (`lib/api.ts:444-455`). Na stronie
publicznej nagłówek zwykle nie poleci, a gdy poleci (admin otwiera własny
podgląd w tej samej przeglądarce), backend go ignoruje. Konsekwencja dla
testów manualnych: **publiczny widok trzeba sprawdzić w oknie prywatnym**,
inaczej łatwo przeoczyć błąd autoryzacji.

## Testy

Backend, `backend/tests/`:

| Test | Asercja |
|---|---|
| `test_presentation_link_requires_role` | rola `user` → `403` |
| `test_presentation_link_cross_org_denied` | admin z innej organizacji → `403` (regresja na wadę nr 2) |
| `test_presentation_link_rotates` | drugi `POST` zwraca inny token; stary → `404` |
| `test_presentation_link_patch_keeps_token` | `PATCH` zmienia `anonymized`, a `token` i `created_at` pozostają bez zmian; stary link nadal działa |
| `test_presentation_link_delete_revokes` | po `DELETE` publiczny `GET` → `404` |
| `test_public_presentation_returns_matrix` | poprawna liczba członków i rang; brak `NameError` (regresja na martwy endpoint) |
| `test_public_presentation_leaks_no_pii` | surowy JSON nie zawiera `@`, `email`, `nip`, `is_ghost`, `invited_at` (regresja na wadę nr 1) |
| `test_public_presentation_anonymized` | `display_name == "Osoba 1"`, `organization_name is None`, brak `full_name` w JSON |
| `test_public_presentation_anonymized_order_is_by_id` | numeracja niezależna od alfabetu |
| `test_public_presentation_lang_en` | `lang=en` zwraca angielskie nazwy talentów |
| `test_public_presentation_unknown_token` | `404` |
| `test_public_rate_limit` | przekroczenie progu → `429` z `Retry-After` |
| `test_public_rate_limit_not_bypassable_by_xff` | 40 żądań z losowym `X-Forwarded-For` przy stałym adresie peera nadal kończy się `429` |

`backend/tests/conftest.py` nadpisuje `get_db` dla **obu** aplikacji
(`app` i `external_app`) — nowe testy publiczne idą przez `app`.

## Poza zakresem

- Wygasanie linku (`expires_at`).
- Wiele linków na zespół (`TeamShareLink`).
- Ochrona hasłem.
- Licznik i log wejść.
- Bramka billingowa.
- Wybór podzbioru członków do prezentacji (parametr `?members=` z `talentpilot-team`).
- Refaktor istniejącego `POST /api/teams/{id}/generate-matrix`, który woła
  zewnętrzną aplikację `talentpilot-team` przez `X-API-Key` — to osobny,
  niezwiązany mechanizm i zostaje nietknięty.

## Ryzyka

- **`generate-matrix` — martwy kod, nie konflikt.** Endpoint
  `POST /api/teams/{id}/generate-matrix` (delegujący do zewnętrznej aplikacji
  `talentpilot-team` przez `X-API-Key`, dziś `501` bo integracja jest
  nieskonfigurowana) **nie ma żadnego wywołania w UI** — zweryfikowane grepem
  po `teams/[id]/page.tsx`. Nie ma więc ryzyka dwóch mylących przycisków
  i nie ma czego ukrywać. Endpoint zostaje nietknięty.
- **Token w URL trafia do historii przeglądarki i Referera.** `noindex`
  ogranicza indeksowanie, ale link przesłany dalej działa dla każdego.
  Modal musi to komunikować wprost.
- **Usunięcie `PresentationContent.tsx`** to −761 linii. Jeśli ktoś linkuje do
  `/presentation/<token>` z zewnątrz, ścieżka pozostaje ta sama, więc stare
  linki działają dalej — pod warunkiem że token w bazie nie został unieważniony.
