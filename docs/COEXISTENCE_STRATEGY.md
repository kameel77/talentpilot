# Strategia Koegzystencji: TalentPilot & TalentPilot-Team

## 1. Wizja Ekosystemu
Platforma TalentPilot docelowo ma stanowić spójny ekosystem, w którym dane i wnioski z poziomu makro (organizacja, zespół) płynnie przenikają się z poziomem mikro (pojedynczy pracownik, menedżer). Dwie główne aplikacje:
*   **TalentPilot-Team:** Narzędzie eksperckie dla Coachów Gallupa oraz analityków HR. Skupia się na makro-strukturze: budowaniu matryc zespołów, analizie rozkładu domen (Wykonywanie, Wpływanie, Budowanie relacji, Myślenie strategiczne) oraz identyfikacji ukrytych luk i potencjałów w całej organizacji.
*   **TalentPilot:** Narzędzie operacyjne (PWA/Mobile) dla menedżerów i pracowników. Skupia się na mikro-akcjach: codziennych wskazówkach (Daily Tips), wsparciu w komunikacji między konkretnymi osobami, przygotowaniach do spotkań 1:1.

## 2. Synergia i Wymiana Danych (Data Flywheel)

Aby obydwie aplikacje dostarczały maksymalną wartość, muszą współdzielić tzw. *Single Source of Truth* (Jedno Źródło Prawdy) w bazie danych (PostgreSQL + pgvector).

### A. Przepływ: TalentPilot-Team -> TalentPilot (Z góry na dół)
*   **Kontekst Zespołowy:** Coach w *TalentPilot-Team* analizuje matrycę zespołu i oznacza konkretne dynamiki (np. "Zespół ma bardzo mało talentów z domeny Wykonywania, co może rodzić problemy z dowożeniem projektów").
*   **Personalizacja:** Ta metadana trafia do systemu RAG w *TalentPilot*. Gdy menedżer wchodzi do *TalentPilot*, AI podpowiada mu: "Zwróć szczególną uwagę na fazę domykania projektów w tym zespole. Twoim ratunkiem może być pracownik X, który ma talent Osiąganie."
*   **Udostępnianie Wniosków:** Coach może "opublikować" część swoich wniosków analitycznych bezpośrednio na dashboardy pracowników w *TalentPilot*, dając im szerszy kontekst ich roli w zespole.

### B. Przepływ: TalentPilot -> TalentPilot-Team (Z dołu do góry)
*   **Behawioralny Feedback:** Pracownicy i menedżerowie używają *TalentPilot* na co dzień (np. oceniając trafność wskazówek AI, zgłaszając konflikty lub wyzwania w notatkach).
*   **Organizacyjna Mapa Ciepła (Heatmap):** Zanonimizowane i zagregowane dane o aktywności i zgłaszanych problemach z *TalentPilot* trafiają do *TalentPilot-Team*. 
*   **Analityka dla Coacha:** Coach widzi: "W dziale IT nagle spadło zaangażowanie, a menedżerowie często pytają AI o 'rozwiązywanie konfliktów'". Pozwala to Coachowi na proaktywną interwencję i precyzyjne szkolenia celowane, zamiast ogólnych warsztatów.

## 3. Współdzielona Architektura Techniczna

*   **Jeden Backend (FastAPI):** Obie aplikacje powinny odpytywać ten sam fundament API, różniąc się jedynie poziomem uprawnień (RBAC - Role-Based Access Control) oraz payloadem (GraphQL lub dedykowane endpointy REST).
*   **Wspólna Baza Danych (PostgreSQL):** Profile talentowe (Top 5 / Full 34), mapowanie użytkowników do zespołów oraz definicje talentów muszą być w jednej bazie.
*   **Inteligencja (RAG & pgvector):** Baza wiedzy wektorowej obsługuje obie aplikacje. Zapytanie od Coacha (`?role=coach`) generuje szerokie analityczne odpowiedzi. Zapytanie od Pracownika (`?role=employee`) generuje krótkie, taktyczne porady.

## 4. Główne korzyści biznesowe
1.  **Dla Coacha:** Przełożenie jednorazowych warsztatów na **ciągły proces rozwojowy**. Coach widzi, jak jego rekomendacje są wdrażane w życie i gdzie aplikacja osobista (TalentPilot) napotyka na opór zespołu.
2.  **Dla Organizacji (HR):** Spójność danych gwarantuje, że wszyscy mówią tym samym "językiem talentów". Ułatwia to onboarding, rekrutację (symulacje "Co Jeśli?" w TalentPilot-Team) i budowanie ścieżek kariery.
3.  **Dla Pracownika/Menedżera:** Poczucie, że aplikacja codzienna "rozumie" szeroki kontekst całej firmy, dając porady dopasowane nie tylko do ich pary (np. Menedżer-Pracownik), ale do całej dynamiki zespołu ukształtowanej przez Coacha.

## 5. Kolejne Kroki Implementacyjne
1.  **Unifikacja bazy danych:** Upewnienie się, że model danych wspiera role `Coach`, `Manager`, `Employee` w obrębie jednej struktury Ogranizacji/Tenant'a.
2.  **API Gateway / Auth:** Wdrożenie SSO (Single Sign-On), by użytkownik w zależności od ról miał dostęp do różnych widoków.
3.  **Projektowanie Endpointów Integracyjnych:** Endpointy pozwalające na tworzenie "Notatek Coacha", które stają się kontekstem wektorowym dla zapytań RAG menedżerów w *TalentPilot*.
