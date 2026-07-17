# Team Analytics Port — widok zespołu (kontekst coacha/lidera)

> Data: 2026-07-17
> Status: zatwierdzony przez użytkownika (z poprawkami do listy członków)
> Branch: `feature/team-analytics-port` (od `main`)

## 1. Kontekst i cel

Aplikacja talentpilot-team miała być uproszczonym narzędziem coacha do oceny matrycy
zespołu, ale decyzją biznesową konteksty coacha, lidera i członka zespołu zostają
zamknięte w jednej aplikacji (talentpilot). Widok zespołu w talentpilot pokazuje dziś
tylko uproszczoną analitykę (matryca + donut domen + radar), podczas gdy
talentpilot-team ma bogatszy zestaw: rangę cech zespołu, heatmapę talentów, luki
zespołowe, krytyczne zależności (SPOF) i profile Top talentów per członek.

Cel: przenieść pełną analitykę zespołową do talentpilot, uprościć listę członków
i dodać trzy nowe statystyki wartościowe w pracy coacha/lidera.

## 2. Stan zastany (istotne fakty)

- `frontend/lib/team-algorithms.ts` w talentpilot jest **identyczną kopią** pliku
  z talentpilot-team — zawiera już `teamTalentRanks` (geometric mean),
  `teamDomainScores`, `findTeamWeaknesses`, `findSPOF`, `checkDomainSpecialist`.
  UI korzysta tylko z dwóch pierwszych.
- `GET /api/teams/{id}/matrix` zwraca pełne wyniki (all ranks) wszystkich członków.
- Backend ma już flow wgrania raportu dla istniejącego użytkownika:
  `POST /api/gallup/parse-pdf` (parsowanie) + `POST /api/gallup/save-talents/{user_id}`
  (zapis); oba opakowane w `frontend/lib/api.ts` (`api.gallup.parsePdf`,
  `api.gallup.saveTalents`).
- Rola użytkownika dostępna z `tokenManager.getUser()`
  (`role: 'admin' | 'manager' | 'coach' | 'user'`); lider zespołu oznaczony
  `is_leader` w danych matrycy.

**Wniosek: zmiany wyłącznie frontendowe.**

## 3. Decyzje projektowe (potwierdzone z użytkownikiem)

| Decyzja | Wybór |
|---|---|
| Zakres portu | Pełny: ranga cech, heatmapa, luki, SPOF, zakładka Profile |
| Próg Top N | **Top 15** (konwencja talentpilot; przełączniki Top 5 / Top 15) |
| Widoczność sekcji ryzyk | Coach/admin/manager **lub** lider zespołu (gating UI) |
| Nowe statystyki | 3 wdrożone teraz, reszta jako backlog (sekcja 7) |
| Lista członków | Uproszczona (bez kolumny talentów), domyślnie zwinięta, upload raportu per osoba |

Argument przyzwyczajenia do obecnego UI **nie jest ważny** — prawie nikt jeszcze nie
korzysta z aplikacji; priorytetem jest zrozumienie procesu przez użytkownika.

## 4. Układ docelowy strony `dashboard/teams/[id]`

Kolejność sekcji (od góry):

1. **Nagłówek zespołu** — bez zmian (nazwa + dropdown zmiany zespołu, przyciski
   Importuj PDF / Dodaj członka). Przycisk „Pokaż/Ukryj matrycę" znika — analityka
   jest zawsze widoczna jako główna treść strony.
2. **Analityka (MatrixDashboard, 3 zakładki):**
   - **Matryca** — bez zmian (tabela 34 talentów, wiersz zespołu, wiersz „w Top 15").
   - **Domeny** — rozszerzona:
     - rząd 1: donut „Reprezentacja w Top 15" (przełącznik Top 5/15) |
       **Ranga cechy zespołu** — pionowa lista tagów `#1..#15` z kolorem domeny |
       radar „Potencjał Domenowy"
     - rząd 2: **Heatmapa talentów** — badge talentów najczęstszych w Top 15
       członków, z licznikiem wystąpień, posortowane malejąco
     - rząd 3 *(tylko uprawnieni — sekcja 5)*: **Luki zespołowe** (talenty w Bottom 5
       u ≥30% zespołu; paski % z opisem „obszary kosztujące zespół energię") |
       **Krytyczne zależności (SPOF)** (talent w Top 10 tylko u jednej osoby;
       nazwisko + ranga) + **Wskaźnik odporności zespołu** (KPI, sekcja 6)
     - rząd 4: **Unikalny wkład osoby** (dla wszystkich) |
       **Sugestie par komplementarnych** *(tylko uprawnieni)* — sekcja 6
   - **Profile** (nowa zakładka) — karty per członek z wynikami: dominująca domena
     (badge), gwiazdka „specjalisty domenowego" (≥4 z Top 5 w jednej domenie,
     tooltip), talenty Top 5/Top 15 jako badge `#ranga Nazwa`, pasek proporcji
     domen na dole karty. Przełącznik Top 5 / Top 15.
3. **Lista członków** — przeprojektowana:
   - **Domyślnie zwinięta** (nagłówek „Członkowie zespołu (N)" + chevron,
     jak collapsible w talentpilot-team).
   - Kolumny (bez checkboxów selekcji — provisioning kont nie istnieje w talentpilot):
     Osoba (avatar, nazwisko, e-mail, badge statusu zaproszenia, korona lidera),
     Rola/stanowisko, **Talenty** (tylko licznik: „✓ 34 talenty" / „Brak danych" —
     bez listy badge'ów; szczegóły są na podstronie użytkownika), Akcje.
   - Akcje per osoba: **Wgraj raport** (nowość — patrz niżej), zaproś/ponów
     zaproszenie (ghost), ustaw lidera, edytuj, usuń — jak dotychczas.
   - Wyszukiwarka członków zostaje w nagłówku listy (aktywna po rozwinięciu).

### Wgranie raportu dla istniejącego członka

Przycisk „Wgraj raport" (ikona Upload) przy każdym członku:
1. wybór PDF → `api.gallup.parsePdf(file)`
2. zapis → `api.gallup.saveTalents(userId, rankings)`
3. **potwierdzenie: „Zaimportowano X/34 talentów dla {imię}"** (toast/inline);
   przy X < 34 ostrzeżenie z liczbą pominiętych; błąd parsowania → czytelny komunikat.
4. odświeżenie danych matrycy.

Obsługuje przypadek „klient zrobił nowy test i ma nowy raport" — nadpisanie talentów
zgodnie z zachowaniem endpointu `save-talents` (istniejące wyniki są zastępowane).

## 5. Widoczność sekcji wrażliwych

`canSeeRisks = user.role ∈ {coach, admin, manager} || currentUserIsLeader`
(porównanie `user.id` z członkiem `is_leader` w danych matrycy).

Sekcje gated: Luki zespołowe, SPOF, Wskaźnik odporności, Pary komplementarne.
Widoczne dla wszystkich: matryca, domeny (donut/rangi/radar/heatmapa), Profile,
Unikalny wkład.

**Świadome ograniczenie:** gating jest wyłącznie UI-owy. Endpoint matrycy już dziś
zwraca członkom pełne rangi (Bottom 5 widać w matrycy kolorami). Ukrywamy
*interpretację ryzyk*, nie dane. Ewentualne twarde ograniczenie danych per rola
= osobna zmiana backendu, poza zakresem.

## 6. Nowe statystyki (wdrażane teraz)

Nowe czyste funkcje w `lib/team-algorithms.ts`, w stylu istniejących:

1. **`uniqueContributions(membersRankMaps, talentCodes)`** — dla każdego członka:
   talenty z jego Top 10, których żaden inny członek nie ma w Top 15.
   UI: sekcja „Unikalny wkład" — per osoba lista badge'ów; pozytywna rama SPOF-a,
   talking points na 1:1 i docenianie. Widoczna dla wszystkich.
2. **`complementaryPairs(membersRankMaps, talentCodes)`** — pary (A,B), gdzie Top 10
   osoby A pokrywa talenty z Bottom 5 osoby B; siła pary = liczba pokrytych talentów
   (obustronnie). Zwraca posortowane pary z listą pokryć.
   UI: karta „Pary komplementarne" — top pary z wyjaśnieniem „A wnosi X tam, gdzie
   B traci energię". Zastosowanie: delegowanie, buddy-pairing, warsztat. Gated.
3. **`teamResilience(membersRankMaps, talentCodes)`** — % talentów z Top 15 zespołu
   (wg `teamTalentRanks`) niesionych przez ≥2 osoby w ich Top 10.
   UI: KPI przy sekcji SPOF („Odporność zespołu: 73%"). Gated.

## 7. Backlog statystyk (propozycje na później)

- **Indeks różnorodności talentowej** — ile z 34 talentów zespół ma łącznie w Top 15;
  miara szerokości repertuaru zespołu.
- **Rozkład dominujących domen członków** — ilu członków ma daną domenę jako
  dominującą (`dominantDomain` już istnieje w algorytmach).
- **Pokrycie domen w Top 5** — domeny bez żadnego reprezentanta w czyimkolwiek Top 5
  (twarda luka domenowa).
- **Team balance score** — pojedynczy wskaźnik równowagi domen (np. odwrotność
  współczynnika zmienności `teamDomainScores`).
- Trendy w czasie (wymaga snapshotów — zmiana backendu).

## 8. Architektura komponentów

Nowe komponenty w `frontend/components/dashboard/` (małe, jednozadaniowe — świadomie
NIE powtarzamy 1400-linijkowego monolitu `TeamDetailContent` z talentpilot-team):

| Komponent | Odpowiedzialność | Props |
|---|---|---|
| `TeamRankList` | tagi #1..#N rangi cech zespołu | `teamRanks`, `topN` |
| `TalentHeatmap` | badge najczęstszych talentów w Top 15 | `counts` |
| `TeamRisks` | Luki + SPOF + KPI odporności | `weaknesses`, `spof`, `resilience`, `members` |
| `MemberProfileCards` | karty Profile per członek | `members`, `topN` |
| `UniqueContributions` | unikalny wkład per osoba | `contributions`, `members` |
| `ComplementaryPairs` | sugestie par | `pairs`, `members` |
| `MemberReportUpload` | flow: wybór PDF → parse → save → wynik | `userId`, `memberName`, `onDone` |

`MatrixDashboard` pozostaje kompozytorem: liczy dane wejściowe raz (rank maps,
teamRanks, scores) i przekazuje w dół; dostaje nowy prop `canSeeRisks: boolean`.
Strona `teams/[id]` przekazuje `canSeeRisks` i renderuje analitykę zawsze
(bez przycisku „Pokaż matrycę"), lista członków jako collapsible.

Dane: bez nowych zapytań — wszystko liczone client-side z odpowiedzi
`api.teams.getMatrix`.

## 9. i18n

Nowe klucze w `messages/pl.json` i `messages/en.json` (sekcja `teams`):
rangi cech, heatmapa, luki (+ opis), SPOF (+ opis, „jedyna osoba"), odporność,
unikalny wkład, pary komplementarne, profile (specjalista domenowy — tooltip),
upload raportu (przycisk, statusy, „Zaimportowano X/34 talentów"), collapsible listy.
Polskie teksty wzorowane na talentpilot-team (`messages/pl.json` tamtego repo).

## 10. Obsługa błędów

- Zespół bez wyników: każda sekcja pokazuje istniejący stan pusty (`noData`).
- Zespół z 1 osobą: luki/SPOF/pary mają sens od ≥2 osób z wynikami — przy <2
  sekcje ryzyk pokazują komunikat „Potrzeba wyników co najmniej 2 osób".
- Upload raportu: błąd parsowania → komunikat z powodem; częściowy import → liczba
  zaimportowanych vs pominiętych; brak zmian stanu przy błędzie zapisu.

## 11. Weryfikacja

- `npm run build` + lint bez błędów.
- Testy jednostkowe nowych czystych funkcji algorytmicznych (jeśli w repo brak
  infry testowej frontendu — weryfikacja ręczna na danych z przykładów
  w talentpilot-team: zespół 4-osobowy „Charamel Family").
- Przejście w przeglądarce: zespół z danymi (≥4 członków z Top 34), zespół pusty,
  zespół 1-osobowy; konto coacha vs konto zwykłego członka (gating);
  upload raportu dla istniejącego członka z potwierdzeniem licznika.

## 12. Poza zakresem

- Zmiany backendu (uprawnienia na poziomie danych, snapshoty trendów).
- Eksport/prezentacja wyników (osobny feature — istnieje `PresentationContent`).
- Wycofanie aplikacji talentpilot-team (osobna decyzja migracyjna).
