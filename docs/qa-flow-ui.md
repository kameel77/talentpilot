# Q&A Flow UI + API Plan (MVP v1)

## 1) Założenia i cele MVP
- **Kanał interakcji:** chat (asystent managera), wspierany przez szybkie akcje i szablony pytań.
- **Zakres:** 2 konteksty (moje talenty → moje problemy; współpraca z zespołem), w języku PL.
- **Dane wejściowe:** Top 10 lub pełne 34 talenty; fallback na „ogólne” odpowiedzi przy brakach.
- **Model odpowiedzi:** **Talent → Kompetencja → Akcja** (konkretnie, bez ogólników).
- **Feedback loop:** użytkownik ocenia skuteczność rekomendacji (% zastosowanych), system uczy się.
- **API:** wersjonowane `/v1`, przygotowane do ekspozycji zewnętrznej w przyszłości.

## 2) User Journeys (2 scenariusze)
### 2.1. „Moje talenty → mój problem”
**Cel:** Rozwiązać problem w oparciu o indywidualne talenty i kontekst sytuacyjny.
1. Użytkownik wpisuje problem (np. „Odkładam trudną rozmowę”).
2. System dopytuje o kontekst (deadline, stawka, osoby).
3. System mapuje talenty → kompetencje → działania (1–3 kroki).
4. Użytkownik zapisuje plan (opcjonalnie) i daje ocenę skuteczności.

### 2.2. „Współpraca z członkiem zespołu”
**Cel:** Dostać rekomendacje komunikacyjne i zadaniowe dla konkretnej osoby.
1. Użytkownik wybiera osobę z zespołu (Top 5 talentów widoczne w profilu).
2. Użytkownik wpisuje temat (np. „feedback o terminach”).
3. System generuje „jak pracować z tą osobą” + ryzyka + przykładowe sformułowania.
4. Użytkownik ocenia skuteczność rekomendacji.

## 3) UI Chat – struktura i kluczowe komponenty
### 3.1. Widok główny (desktop)
```
┌───────────────────────────────────────────────────────────────────┐
│ TopBar: [Team Selector] [Language: PL] [Profile]                  │
├───────────────────────────────────────────────────────────────────┤
│ Sidebar                                                          │
│  - Moje talenty (Top 5/10)                                        │
│  - Zespół (lista osób)                                            │
│  - Szablony pytań                                                 │
│     • Trudna rozmowa                                              │
│     • Konflikt priorytetów                                        │
│     • Delegowanie                                                 │
├───────────────────────────────────────────────────────────────────┤
│ Chat Area                                                         │
│  [User] „Mam problem z… ”                                         │
│  [Assistant]                                                      │
│   Talent: Strategic                                               │
│   Kompetencja: Priorytetyzacja decyzji                             │
│   Akcja:                                                          │
│    1) Zdefiniuj kryteria decyzji (15 min)                          │
│    2) Oceń 3 opcje wg kryteriów                                    │
│    3) Zablokuj 1 wybór na 7 dni                                    │
│   CTA: [Zapisz plan] [Zadaj inne pytanie]                          │
│                                                                   │
│  Feedback: „Czy rekomendacja zadziałała?” [Tak/Nie/Skala]          │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2. Widok mobilny (PWA)
```
┌──────────────────────────────┐
│ TopBar: [Team] [PL] [Profile]│
├──────────────────────────────┤
│ Chat Area                    │
│  [User] ...                  │
│  [Assistant] ...             │
│  [CTA buttons]               │
├──────────────────────────────┤
│ Bottom Nav                   │
│  - Chat  - Talenty  - Zespół │
└──────────────────────────────┘
```

### 3.3. Komponenty UI (proponowane)
- **ChatMessageCard** (role: user/assistant)
- **TalentContextBadge** (talent + krótki opis)
- **CompetencyActionBlock** (3 poziomy: talent → kompetencja → akcja)
- **QuickPromptChips** (szablony pytań)
- **TeamMemberPicker** (lista + top talenty)
- **FeedbackRating** (Tak/Nie/Skala 1–5 + komentarz)

## 4) Model odpowiedzi (Talent → Kompetencja → Akcja)
**Zasada:** Każda odpowiedź musi zawierać:
1. **Talent** (który wpływa na zachowanie)
2. **Kompetencja biznesowa** (przekład na język pracy)
3. **Akcja** (1–3 konkretne kroki, mierzalne, krótkie)

Przykład:
- Talent: **Achiever**
- Kompetencja: **Utrzymanie tempa i odpowiedzialność**
- Akcja:
  1) Zamknij 1 zadanie dziennie do 12:00
  2) Zrób 10-minutowy „daily review”
  3) Ustal 1 wskaźnik (np. % zadań zakończonych)

## 5) Obsługa brakujących talentów (fallback)
Jeśli brakuje danych o talentach:
- System generuje **ogólną odpowiedź** opartą o typowe kompetencje managerskie.
- Odpowiedź oznaczona jako „fallback”.
- CTA: „Uzupełnij talenty, aby otrzymać precyzyjne rekomendacje”.

## 6) Feedback loop (uczenie się po MVP)
- Po każdej rekomendacji użytkownik ocenia skuteczność:
  - **Tak/Nie** + **Skala 1–5**
  - opcjonalny komentarz („co zadziałało / co nie”)
- Dane trafiają do warstwy analitycznej, aby:
  - poprawiać dopasowanie odpowiedzi,
  - identyfikować słabe rekomendacje,
  - optymalizować modele odpowiedzi per talent.

## 7) Zarys API + architektury (v1)
### 7.1. Moduły
- **Talent Profile Service**: przechowywanie talentów (Top 10/34), fallback.
- **Q&A Service**: generowanie odpowiedzi na pytania (talent → kompetencja → akcja).
- **Team Service**: relacje manager–zespół, dostęp do profili.
- **Feedback Service**: zapisy ocen skuteczności.

### 7.2. Endpoints (propozycja)
```
POST   /v1/qa/query
GET    /v1/qa/history
POST   /v1/qa/feedback
GET    /v1/teams
GET    /v1/teams/{teamId}/members
GET    /v1/talents/me
GET    /v1/talents/{userId}
```

### 7.3. Przykładowy request/response
**POST /v1/qa/query**
```json
{
  "context": "self",
  "question": "Odkładam trudne rozmowy",
  "userId": "u_123",
  "targetUserId": null,
  "language": "pl"
}
```

**Response**
```json
{
  "answer": {
    "talent": "Strategic",
    "competency": "Priorytetyzacja decyzji",
    "actions": [
      "Zdefiniuj kryteria decyzji (15 min)",
      "Oceń 3 opcje wg kryteriów",
      "Zablokuj 1 wybór na 7 dni"
    ],
    "fallback": false
  },
  "source": "ai+talent-mapping"
}
```

## 8) Manual QA (UI)
- Czy chat poprawnie rozróżnia kontekst „self” vs „team member”?
- Czy odpowiedź zawsze zawiera Talent → Kompetencja → Akcja?
- Czy fallback jest widoczny, gdy brak danych talentowych?
- Czy feedback zapisuje się po każdej odpowiedzi?
- Czy UI działa poprawnie w trybie mobilnym?

## 9) Następne kroki (po akceptacji planu)
1. Makieta UI w kodzie (Next.js + shadcn/ui) dla widoku chat.
2. Szkic backendowych modeli danych i podstawowych endpointów v1.
3. Dodanie „feedback loop” w bazie danych.

## 10) Plan działania (MVP v1)
1. **Frontend (Q&A Copilot):**
   - Widok `/dashboard/qa` z sekcjami: kontekst, chat, feedback, talenty i fallback.
   - Komponenty: ChatBubble, ResponseBlock, QuickPromptChips, FeedbackRating.
2. **Backend (API v1):**
   - Endpointy `/v1/qa/query`, `/v1/qa/feedback`, `/v1/qa/history`.
   - Walidacja Pydantic: kontekst (`self` | `team`), język (`pl` | `en`).
3. **Dane i modelowanie:**
   - Encje: Query, Answer, Feedback, TalentSnapshot.
   - Fallback dla brakujących talentów (oznaczenie `fallback=true`).
4. **Quality & feedback loop:**
   - Zbieranie skuteczności (Tak/Nie, skala 1–5, komentarz).
   - Dashboard jakości odpowiedzi (faza 2).
