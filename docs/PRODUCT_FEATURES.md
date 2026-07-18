# TalentPilot — Mapa Funkcjonalności

> Ostatnia aktualizacja: 2026-07-03

## Legenda
- ✅ Zrealizowane  
- 🔧 Częściowo zrealizowane  
- ⬜ Do realizacji  

---

## 1. Infrastruktura & Auth

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Rejestracja / Login / Logout | JWT, hash hasła, sesje tokenowe |
| ✅ | Reset hasła | Email link + formularz nowego hasła |
| ✅ | Role: Admin / Manager / User | RBAC na endpointach + UI |
| ✅ | Multi-tenancy (organizacje) | Separacja danych per organizacja |
| ✅ | Responsywny sidebar (mobile) | Hamburger menu, slide-in sidebar |
| ✅ | Ghost Invite | Zaproszenie usera z gotowym profilem talentów |
| ✅ | Invite Accept (/join) | Akceptacja zaproszenia z ustawieniem hasła |
| ✅ | Deaktywacja usera | Admin toggle active/inactive z poziomu listy |
| ✅ | Rejestracja coacha (self-serve) | `/register/coach` — konto COACH + prywatny workspace |
| ✅ | Onboarding coacha (kreator) | Klient indywidualny lub organizacja → zespół → osoby → matryca |
| ✅ | Klienci indywidualni coacha | Zakładka Indywidualni + przypinanie do organizacji (move) |
| ✅ | UI zawężone dla roli COACH | Ukryte Moje Talenty / Mój Ruch; selektor klienta |

---

## 2. Talenty & Profile

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Import talentów (PDF Gallup) | Parser Top 34 z oficjalnego PDF CliftonStrengths |
| ✅ | Moje talenty (`/my-talents`) | Widok własnych 34 talentów z domenami |
| ✅ | Profil użytkownika (`/users/[id]`) | Karta z talentami, domenami, User Manual |
| ✅ | User Manual (Instrukcja Obsługi) | Supermoce, Wyzwalacze, Blokady, Feedback Style |
| ✅ | Tłumaczenia talentów (PL/EN) | `talent_translations` z pełnymi opisami |
| ✅ | Domeny CliftonStrengths | 4 domeny: Executing, Influencing, Relationship, Strategic |

---

## 3. Zespoły & Organizacja

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Dashboard (`/dashboard`) | KPI (ilość userów, talentów, coverage), rozkład domen, lista zespołu |
| ✅ | Lista użytkowników (`/users`) | Filtrowanie, zapraszanie, przypisywanie talentów |
| ✅ | Zespoły (`/teams`) | CRUD zespołów, przypisywanie członków |
| ✅ | Widok zespołu (`/teams/[id]`) | Szczegóły zespołu z członkami i ich talentami |
| ⬜ | Mapa Kompetencji (Heatmap) | Wizualizacja zespołu po obszarach biznesowych |

---

## 4. Porównywanie & Synergia

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Porównanie 1:1 (`/compare`) | Dual selector, synergy score, shared/unique talents |
| ✅ | Domain Balance | Wizualne porównanie domen obu osób |
| ✅ | Collaboration Tips | Deterministyczne wskazówki współpracy |
| ⬜ | Power Couple Recommendation | Algorytm sugerujący najlepsze pairingi w zespole |
| ⬜ | Blind Spot Detector | Ostrzeganie o brakujących domenach w zespole |

---

## 5. AI & RAG

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Q&A Copilot (`/qa`) | Pytania o talenty z odpowiedzią Talent→Kompetencja→Akcja |
| ✅ | RAG (pgvector) | Wektorowe wyszukiwanie wiedzy z Knowledge Base |
| ✅ | Baza wiedzy — Merytoryka | Admin dodaje wpisy CliftonStrengths (embeddingi auto) |
| ✅ | Baza wiedzy — FAQ | Auto-generowane z zatwierdzonych odpowiedzi AI |
| ✅ | Review odpowiedzi AI | Admin zatwierdza/edytuje odpowiedzi → trafiają do KB |
| ✅ | Tips — Mój Ruch (`/tips`) | AI daily tip z 5 kontekstami (feedback, 1:1, konflikt, motywacja) |
| ✅ | Tips — Mosty (`/tips`) | AI interaction guide + compare engine data |
| ✅ | Feedback na tipach | Thumbs up/down, zapis do DB |
| ✅ | Streaming (SSE) — QA + Tips | `/v1/qa/query/stream`, `/tips/daily/stream`, `/tips/synergy/{id}/stream`; frontend z fallbackiem; toggle `qa_streaming_enabled` (2026-07-19) |
| ⬜ | Cache podobnych pytań | Kod gotowy (zakomentowany w qa.py), do aktywacji |

---

## 6. Admin Panel

| Status | Funkcjonalność | Opis |
|:------:|----------------|------|
| ✅ | Ustawienia AI (`/admin/settings`) | Model czat, model embedding, limit zapytań, system prompt, streaming toggle |
| ✅ | Zarządzanie wiedzą (`/admin/knowledge`) | CRUD wpisów z auto-embeddingami |
| ✅ | Review odpowiedzi AI | Lista pending, approve/reject/edit |

---

## 7. Przyszłe kierunki (V2+)

| Priorytet | Funkcjonalność | Opis |
|:---------:|----------------|------|
| ✅ | Streaming (SSE) | QA Copilot + Tips (Mój Ruch, Mosty) — 2026-07-19 |
| ⬜ | Mapa Ciepła Kompetencji | Wizualizacja zespołu po obszarach biznesowych |
| ⬜ | Blind Spot Detector | Analiza luk kompetencyjnych w zespole |
| ⬜ | Power Couple | Algorytmiczne sugestie pairingów |
| ⬜ | Calendar Hook | Pre-meeting briefing na podstawie kalendarza |
| ⬜ | PWA + Push Notifications | Offline, ikona na home screen, push z daily tipem |
| ⬜ | AI Team Simulation | Symulator „Co jeśli?" z wirtualnym kandydatem |
| ⬜ | Org Health Map | Widok HR/CEO na całą firmę |
| ⬜ | Career Pathing | Sugestie ścieżek kariery na bazie talentów |
| ⬜ | Voice Copilot | Interfejs głosowy na mobile |
