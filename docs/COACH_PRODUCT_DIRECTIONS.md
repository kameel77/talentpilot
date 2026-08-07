# Kierunki rozwoju — praca coacha

**Data:** 2026-08-07
**Kontekst:** uzupełnienie `COMMERCIALIZATION_STRATEGY.md` (Etap 1: coach jako klient). Ten dokument patrzy nie na model biznesowy, tylko na **dzień pracy coacha** i szuka miejsc, w których produkt go dziś zostawia samego.

---

## 1. Punkt wyjścia — co coach ma dzisiaj (fakty z kodu)

| Jest | Nie ma |
|---|---|
| Klienci indywidualni i organizacje, zespoły | Notatek z sesji i historii współpracy |
| Import raportów Gallupa z PDF (pojedynczo i masowo) | Eksportu PDF (brak `reportlab`/`weasyprint` w zależnościach) |
| Profil talentów, matryca zespołu, porównanie 1:1 | Brandingu coacha na materiałach |
| Asystent AI (QA) i wskazówki, streaming SSE | Widoku „stan mojej praktyki" / kolejki pracy |
| Publiczna wizytówka klienta (`/aboutme/{token}`) | Zaangażowania klienta między sesjami |
| **Tryb prezentacji zespołu** (`/presentations/{token}`) — istnieje, jest niedoceniony | Billingu (osobny dokument) |

**Wniosek z tej tabeli:** produkt bardzo dobrze obsługuje **wprowadzenie danych** i **jednorazowy wgląd**. Nie obsługuje **relacji rozciągniętej w czasie** ani **momentu, w którym coach zarabia** (sesja i warsztat).

---

## 2. Gdzie realnie leży wartość dla coacha

Przychód coacha Gallupa pochodzi z trzech źródeł: sesji 1:1, warsztatów zespołowych i retainerów. Ich koszt czasowy rozkłada się mniej więcej tak:

1. **Przygotowanie do sesji** — przypomnieć sobie, kim jest klient, co ustalili ostatnio, co wtedy nie wyszło. Dziś: coach robi to w swoim Notion/zeszycie, a TalentPilot ma tylko talenty. **To jest największa dziura.**
2. **Prowadzenie sesji / warsztatu** — potrzebuje czegoś, co pokaże klientowi na ekranie. Tryb prezentacji istnieje, ale jest zakopany.
3. **Domknięcie** — wysłać klientowi materiał, umówić follow-up. Dziś: link do wizytówki. Brak PDF-a, brak follow-upu.
4. **Utrzymanie portfela** — kto wypadł z kontaktu, u kogo brakuje raportu. Dziś: brak — coach musi to trzymać w głowie.

Uwaga strategiczna: punkty 1 i 4 to **dane, które narastają**. Punkty 2 i 3 to **funkcje, które można skopiować**. Retencja bierze się z 1 i 4 — coach, który ma w TalentPilocie dwa lata historii sesji, nie odejdzie. Coach, który ma tylko ładny eksport PDF, odejdzie do lepszego eksportu.

---

## 3. Kierunki — uporządkowane

### A. Warstwa sesji: notatki, historia, ustalenia *(najwyższy priorytet)*

Zakładka „Sesje" na profilu klienta: data, temat, notatka coacha, ustalenia/zadania z terminem, prywatne vs widoczne dla klienta.

**Dlaczego pierwsze:** zamienia produkt z „miejsca, gdzie leżą profile" w „miejsce, w którym mieszka relacja coachingowa". Jedyny mechanizm retencji, który rośnie sam. Tanie: jedna tabela + zakładka.

**Dlaczego to nie jest oczywiste:** kusi, żeby najpierw robić eksport PDF (bo jest w strategii i widać go od razu). Ale PDF to funkcja, którą konkurent doda w tydzień. Historia sesji to dane, których nie skopiuje.

**Efekt uboczny:** odblokowuje kierunek D.

---

### B. Eksport PDF z brandingiem coacha *(strategia: must-have #3 + #5, połączone)*

Strategia trzyma eksport PDF i white-label osobno (poz. 3 i 5). **Zrobiłbym je razem**, bo osobno pierwsze jest tylko kosztem, a razem stają się kanałem dystrybucji: każdy PDF, który coach wysyła swojemu klientowi, to materiał z logo coacha i dyskretnym „powered by TalentPilot" — czyli lead.

Zakres minimalny: profil klienta + matryca zespołu, logo i dane kontaktowe coacha w nagłówku/stopce.

---

### C. Tryb warsztatu — rozwinięcie tego, co już jest

`/presentations/{token}` już działa. To najtańsza duża wygrana w całym zestawieniu, bo fundament stoi, a dotyczy **najdroższej godziny w kalendarzu coacha** — warsztatu.

Do dołożenia: pełny ekran bez nawigacji, przełączanie widoków (domeny → matryca → pary), podświetlanie osoby, ukrywanie nazwisk (warsztaty anonimowe). To nie jest nowa funkcja, tylko dokończenie istniejącej.

---

### D. Brief przedsesyjny generowany przez AI

„Co warto poruszyć z Anną na najbliższej sesji" — na bazie jej talentów, historii ustaleń (kierunek A) i tego, co zostało niedomknięte.

To jest **właściwe zastosowanie AI w tym produkcie**. Dzisiejszy asystent odpowiada na pytania, które coach musi sam wymyślić. Brief oszczędza mu 20–30 minut przygotowania przy każdej sesji — czyli mierzalne pieniądze przy stawce dziennej. Wymaga A jako źródła kontekstu.

---

### E. Zaangażowanie klienta między sesjami

Klient dostaje link (już mamy) i może dopisać własną refleksję: co mu wyszło, gdzie utknął. Coach widzi to przed sesją.

Coaching umiera między sesjami, nie na sesjach. To także jedyny kierunek, który zbiera dane od strony klienta — a w Etapie 2 (B2B2B) klient staje się użytkownikiem końcowym, więc ta ścieżka jest inwestycją w przyszły model.

**Ryzyko:** rozszerza powierzchnię RODO (dane wpisywane przez pracowników klienta). Wymaga decyzji o retencji i powierzeniu danych, zanim to wejdzie.

---

### F. Przegląd praktyki / kolejka pracy

Dashboard coacha jako lista rzeczy do zrobienia, nie zestaw kafelków: kto nie miał sesji od 60 dni, u kogo brakuje raportu Gallupa, które zespoły mają niekompletne profile, komu wysłano zaproszenie bez odpowiedzi.

Tanie (dane już są), a zmienia charakter aplikacji z „archiwum" na „narzędzie pracy". Naturalne miejsce na pierwsze wdrożenie po A.

---

### G. Świadomie odłożone

Abstrakcja frameworków (Strengthscope/HIGH5) — zgodnie ze strategią zostaje długiem do rewizji przy pierwszym sygnale od Gallupa albo pierwszym coachu multi-framework. Voice Copilot, symulacje zespołowe, ścieżki kariery — żadne nie przybliża pierwszych dziesięciu płacących coachów.

---

## 4. Rekomendowana kolejność

| # | Kierunek | Uzasadnienie | Szacunek |
|---|---|---|---|
| 1 | **A — warstwa sesji** | Retencja, odblokowuje D, tanie | 3–5 dni |
| 2 | **C — dokończenie trybu warsztatu** | Fundament istnieje, dotyka najdroższej godziny coacha | 2–3 dni |
| 3 | **B — PDF + branding razem** | Deliverable + kanał dystrybucji | 5–8 dni |
| 4 | **F — kolejka pracy** | Zmienia charakter produktu, dane już są | 2–3 dni |
| 5 | **D — brief AI** | Największy „wow", ale wymaga A | 3–4 dni |
| 6 | **E — zaangażowanie klienta** | Inwestycja w Etap 2, wymaga decyzji RODO | 5+ dni |

Billing jest poza tą listą — to warunek konieczny biznesu, nie kierunek produktowy. Patrz `BRIEF_BILLING_TRIAL.md`.

---

## 5. Zastrzeżenie, które trzeba postawić wprost

**Ta kolejność jest hipotezą, nie wiedzą.** Opiera się na modelu pracy coacha, a nie na danych z produktu — bo danych nie mamy. Nadal nie ma zdarzeń analitycznych, o które upominam się od trzech iteracji: `wizard_completed`, `pdf_imported`, `presentation_opened`, `profile_link_copied`, `assistant_query`.

Bez nich za trzy miesiące będziemy się spierać o priorytety tym samym argumentem co dziś — przeczuciem. Pięć zdarzeń to kilka godzin pracy i jedyna rzecz na tej liście, której **nie da się nadrobić wstecz**.

Drugie źródło prawdy jest darmowe i dostępne od zaraz: strategia zakłada 5–8 design partnerów. Trzy rozmowy po 30 minut zweryfikują tę listę lepiej niż dowolna analiza — łącznie z tą.
