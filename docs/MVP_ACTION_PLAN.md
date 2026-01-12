# Szczegółowy Plan Działania: MVP i Dalej

## Tydzień 1: Setup & Data Model
- [ ] Inicjalizacja repozytorium (Front/Back).
- [ ] Konfiguracja bazy danych (Postgres) i ról (Admin, Manager, User).
- [ ] Implementacja modelu danych dla 34 talentów Gallupa.

## Tydzień 2: Core Engine
- [ ] CRUD dla Organizacji i Zespołów.
- [ ] Funkcja importu talentów (manualny input na start).
- [ ] Prosty algorytm mapujący Talenty -> 4 Domeny Gallupa.

## Tydzień 3: UI/UX & Visualization
- [ ] Dashboard Managera (Team Grid).
- [ ] Karta Pracownika (User Manual).
- [ ] Responsywność (Mobile-first).

## Tydzień 4: AI & RAG (Start)
- [ ] Wdrożenie pgvector.
- [ ] Pierwsze "AI Tips" oparte na stałej bazie wiedzy (FAQ).

## Dalsze Kroki (Post-MVP)
1. **Automatyzacja:** Import z plików CSV/PDF generowanych przez Gallupa.
2. **PWA:** Pełna obsługa offline i ikonka na ekranie głównym.
3. **Premium:** Moduł "Organizational Health" (analiza luk kompetencyjnych w całej firmie).

## Backend Ready for Mobile & Desktop
- **Authentication:** JWT (JSON Web Tokens) – stabilne i bezpieczne dla aplikacji PWA oraz sesji desktopowych.
- **Image Optimization:** Backend automatycznie serwuje avatary i grafiki w formatach WebP (oszczędność danych na mobile).
- **Batching:** Endpointy dla mobile muszą wspierać "batching" – jedno zapytanie pobiera zestaw: (Profil usera + Top3 porady + powiadomienia), aby zredukować liczbę requestów po sieci mobilnej.