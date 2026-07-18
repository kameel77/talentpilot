# Strategia komercjalizacji TalentPilot wśród coachów

> Data: 2026-07-19 · Status: analiza strategiczna do decyzji
> Założenia: rynek startowy PL · model etapowy (coach-jako-klient → coach-jako-kanał) · founder sam jest coachem

---

## 1. Teza strategiczna

**Sprzedajemy coachom nie aplikację, tylko powtarzalny przychód.** Największy problem biznesowy coacha Gallupa to jednorazowość: warsztat się kończy, wiedza wyparowuje, klient nie wraca. TalentPilot zamienia jednorazowy warsztat w ciągłą usługę — coach zostawia u klienta "żyjące" narzędzie, które podtrzymuje jego obecność i uzasadnia retainer. To jest komunikat sprzedażowy nr 1, nie "AI tips" ani "matryca talentów".

Konsekwencja: pozycjonujemy TalentPilot jako **narzędzie pracy coacha (practice management + delivery)**, a nie jako kolejną apkę HR. Rynek apek HR jest zatłoczony; rynek narzędzi dla coachów strengths jest niemal pusty po tym, jak Gallup kupił Cascade (2022) i wchłonął go do Gallup Access.

---

## 2. Kontekst — co mamy (fakty)

- Produkt funkcjonalnie gotowy do pilotażu z coachami: self-serve rejestracja coacha, prywatny workspace, klienci indywidualni + organizacje, onboarding kreatorem, import PDF Gallupa, compare/synergy, Q&A Copilot z RAG, tips.
- Braki istotne komercyjnie: brak billingu/subskrypcji, brak streamingu SSE (50s oczekiwania na odpowiedź AI = ryzyko na demo), brak white-label/brandingu coacha, brak eksportu raportów (coachowie żyją z PDF-ów dla klientów).
- Founder jest certyfikowanym coachem → wiarygodność w społeczności, własna praktyka jako klient zerowy, dostęp do polskiej społeczności coachów Gallupa.

---

## 3. Ryzyko krytyczne: własność intelektualna Gallupa

**To jest ryzyko egzystencjalne i musi być zaadresowane przed komercjalizacją.** Fakty:

- Gallup ma zastrzeżone znaki towarowe na nazwę CliftonStrengths i **wszystkie 34 nazwy talentów**, oraz prawa autorskie do opisów tematów. Tworzenie aplikacji/platform wykorzystujących IP Gallupa (w tym framework 34 talentów) bez pisemnej zgody jest zakazane w ich Terms of Use, a Gallup egzekwuje to agresywnie.
- Precedens: Cascade — najbliższy odpowiednik TalentPilot (narzędzie coacha do przechowywania profili klientów i generowania raportów zespołowych) — został **przejęty przez Gallupa w 2022** i włączony do Gallup Access. Gallup traktuje tę przestrzeń jako swoją.
- Coachowie certyfikowani mają podpisane umowy certyfikacyjne — narzędzie naruszające IP Gallupa naraża także ich, co zabije adopcję w tej grupie.

**Rekomendowane działania (przed sprzedażą pierwszej subskrypcji):**
1. **Audyt IP aplikacji**: własne opisy talentów (parafrazy, nie kopie z PDF), disclaimer "CliftonStrengths® is a trademark of Gallup, Inc. TalentPilot is not affiliated with or endorsed by Gallup", zero znaków Gallupa w nazwie, domenie i materiałach marketingowych. Import PDF jest OK (dane klienta należą do klienta), ale treści w Knowledge Base muszą być autorskie.
2. **Konsultacja z prawnikiem IP** (jednorazowo, przed launch) — koszt mały, ryzyko odwracalne w zero.
3. **Strategia dwutorowa**: równolegle zaprojektować warstwę abstrakcji "framework-agnostic" (talenty jako konfigurowalne taksonomie), żeby w razie eskalacji móc obsłużyć Strengthscope/HIGH5/własne modele kompetencji. Niski koszt teraz (dane już są w tabelach), duża opcja na przyszłość.
4. Docelowo rozważyć kontakt z programem partnerskim Gallupa — ale dopiero z trakcją, z pozycji wartości (dowieziona adopcja = argument), nie z pozycji proszącego.

To nie jest powód, by nie budować — Strengthscope, HIGH5 i dziesiątki narzędzi koegzystują z Gallupem. To powód, by zrobić higienę IP **teraz**, póki jest tania.

---

## 4. Rynek i konkurencja (skrót)

| Gracz | Czym jest | Luka, którą zostawia |
|---|---|---|
| Gallup Access (+ wchłonięty Cascade) | Oficjalna platforma: raporty, team grid | Drogi, EN-first, zero AI-coachingu operacyjnego, zero warstwy "co mam zrobić jutro z Jankiem" |
| Strengthscope, HIGH5 | Alternatywne assessmenty z własnymi platformami | Inny framework — nie obsługują bazy zainstalowanej CliftonStrengths |
| Narzędzia coachingowe ogólne (CoachAccountable itp.) | Practice management | Zero merytoryki talentowej |
| Excel + PDF-y | Realny "konkurent" nr 1 u polskich coachów | Wszystko |

**Wniosek:** realna konkurencja w PL to Excel i PowerPoint. Przewaga TalentPilot: język polski (tłumaczenia talentów już są), AI operacyjne (Q&A, tips, mosty), warstwa zespołowa. Bariera wejścia niska, więc przewagą długoterminową będzie **polska baza wiedzy RAG + społeczność coachów**, nie kod.

---

## 5. Model biznesowy — dwa etapy

### Etap 1 (teraz → ~6 mies.): Coach jako klient (B2B SaaS)
Coach płaci za narzędzie do prowadzenia własnej praktyki.

- **Pricing (hipoteza do walidacji):** Free — 1 organizacja / 5 profili (hak akwizycyjny). Pro — ~200–300 zł/mies.: bez limitu klientów, AI, eksporty. Studio — ~500 zł/mies.: white-label, własna baza wiedzy coacha.
- Kotwica cenowa: jeden dodatkowy warsztat/miesiąc z nawiązką pokrywa roczną subskrypcję. Cena musi być nieistotna wobec stawki dziennej coacha.
- **Cel walidacyjny:** 10 płacących coachów = potwierdzony PMF w niszy. 50 coachów × 250 zł = 12,5k MRR — mało jako biznes, dużo jako dowód i kanał.

### Etap 2 (po walidacji): Coach jako kanał (B2B2B)
Coach wprowadza TalentPilot do organizacji klienta; organizacja płaci per pracownik/miesiąc, coach dostaje rev-share (20–30%) i dashboard analityczny nad swoimi wdrożeniami (to jest już opisana wizja COEXISTENCE_STRATEGY — "coach widzi, jak jego rekomendacje żyją w firmie").

- Tu jest właściwa skala: 1 coach → 5 organizacji → setki seatów. Coach staje się sprzedawcą z prowizją, a churn spada, bo wyjęcie narzędzia = zerwanie relacji z coachem.
- Warunek wejścia: Etap 1 musi wyprodukować 10–15 coachów-ambasadorów, którzy ufają produktowi.

**Dlaczego ta kolejność jest słuszna:** Etap 1 daje szybki przychód, krótki cykl sprzedaży (decyzja jednej osoby) i pętlę feedbacku; Etap 2 daje skalę, ale wymaga zaufania kanału, billingu per-seat i dojrzałości produktu. Odwrotna kolejność (od razu B2B2B) = długie cykle sprzedaży bez dowodów.

---

## 6. Go-to-market PL (dźwignia: founder-coach)

1. **Własna praktyka jako pierwszy case study** — każdy warsztat kończony wdrożeniem TalentPilot; mierzyć retencję klienta z narzędziem vs bez.
2. **Design partners (miesiąc 1–2):** 5–8 znajomych coachów, darmowo na 3 miesiące w zamian za cotygodniowy feedback i zgodę na case study. Selekcja: aktywni, z portfelem klientów firmowych.
3. **Dystrybucja przez społeczność, nie przez ads:** polska społeczność coachów Gallupa jest mała i gęsta (grupy FB/LinkedIn, konferencje strengths, sieci absolwentów certyfikacji). Content: "jak zamieniłem warsztat w retainer" — historie, nie features.
4. **Produkt jako marketing:** raport zespołowy generowany z aplikacji z dyskretnym brandingiem "powered by TalentPilot" — każdy PDF wysłany do klienta coacha to lead.
5. Nie budować self-serve growth machine na tym etapie — 100% sprzedaży founder-led, bo rozmowy sprzedażowe = badania produktowe.

---

## 7. Priorytety produktowe (kolejność wg wartości komercyjnej)

**Must-have przed pobraniem pierwszej złotówki:**
1. **Billing** (Stripe subskrypcje + faktury) — bez tego nie ma biznesu.
2. **Streaming SSE** — 50s oczekiwania zabija demo; mechanizm już częściowo gotowy (toggle w adminie).
3. **Eksport raportów PDF** (profil klienta, matryca zespołu) — coachowie dostarczają PDF-y; to też wehikuł "powered by".
4. **Higiena IP** (sekcja 3): autorskie opisy, disclaimery.

**Zaraz po (wzmacnia retencję i pricing Studio):**
5. White-label / branding coacha na raportach i workspace.
6. Własna baza wiedzy coacha (jego metodyka w RAG — to buduje lock-in: coach, który wgrał swoją wiedzę, nie odejdzie).
7. Blind Spot Detector / Heatmap zespołu — już w backlogu, silny "wow" na demo.

**Świadomie odłożone:** Voice Copilot, AI Team Simulation, Career Pathing, wersja EN — żadne z nich nie przybliża pierwszych 10 płacących coachów. Dług: brak abstrakcji frameworków (sekcja 3, pkt 3) — akceptowalny, rewizja przy pierwszym sygnale od Gallupa lub pierwszym coachu multi-framework.

---

## 8. Ryzyka

| Ryzyko | Prawdop. | Wpływ | Mitygacja |
|---|---|---|---|
| Eskalacja IP od Gallupa | Średnie | Krytyczny | Sekcja 3: audyt, prawnik, framework-agnostic jako opcja |
| Gallup dodaje AI do Access | Wysokie (długoterm.) | Wysoki | PL-first, głębia operacyjna, relacje z coachami — Gallup nie zejdzie do niszy PL |
| Mały TAM w PL (Etap 1) | Pewne | Średni | Etap 1 to walidacja, nie endgame; skala jest w Etapie 2 i EN |
| Coachowie nietechniczni, wolna adopcja | Średnie | Średni | Onboarding "white glove" przez foundera, kreator już istnieje |
| RODO (dane psychometryczne pracowników) | Niskie | Wysoki | DPA, hosting EU (Hetzner ✓), umowy powierzenia dla organizacji |

---

## 9. Plan 90 dni

- **Dni 1–30:** higiena IP + prawnik · billing (Stripe) · streaming SSE · rekrutacja 5–8 design partnerów.
- **Dni 31–60:** design partnerzy live · eksport PDF · iteracje z feedbacku · pierwsze case study z własnej praktyki.
- **Dni 61–90:** launch płatnych planów dla design partnerów i społeczności · cel: **10 płacących coachów** · decyzja go/no-go dla Etapu 2 na bazie danych (aktywacja, retencja tygodniowa, NPS coachów).

**KPI Etapu 1:** liczba płacących coachów · liczba profili klientów wgranych per coach (proxy realnego użycia) · odsetek coachów aktywnych tygodniowo · MRR.

---

## 10. Rekomendacja

Wchodzić w komercjalizację modelem etapowym, ale **bramka nr 1 to higiena IP, nie kod**. Następnie minimalny zestaw komercyjny (billing, SSE, eksport PDF) i founder-led sprzedaż do 10 płacących coachów w 90 dni. Etap 2 (coach jako kanał, rev-share, per-seat w organizacjach) uruchamiać wyłącznie po potwierdzeniu retencji w Etapie 1.
