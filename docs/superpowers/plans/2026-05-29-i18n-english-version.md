# i18n English Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PL ↔ EN language switcher to TalentPilot — stored per user on the backend, applied to UI labels and AI-generated content.

**Architecture:** next-intl v4 in message-based mode (no URL prefix). A `locale` cookie is set on login from `user.language`, read by the root layout server component, and passed to `NextIntlClientProvider`. All 26 pages use `useTranslations()`. AI endpoints use `current_user.language` from DB instead of hardcoded `"pl"`.

**Tech Stack:** next-intl v4.8.3 (already installed), FastAPI/Alembic (backend), Next.js App Router (frontend)

---

## File Map

**New files:**
- `backend/alembic/versions/k5f6g7h8i9j0_add_language_to_user.py`
- `frontend/i18n/request.ts`
- `frontend/messages/pl.json`
- `frontend/messages/en.json`
- `frontend/lib/locale.ts`

**Modified files (backend):**
- `backend/models.py` — add `language` column to `User`
- `backend/schemas.py` — add `language` to `UserUpdate`, `UserResponse`
- `backend/routers/qa.py` — use `current_user.language` as fallback
- `backend/routers/tips.py` — pass `current_user.language` to service
- `backend/routers/compare.py` — use `current_user.language` as default (dashboard.py unchanged — it only counts domain aggregates, no talent name fetching)

**Modified files (frontend):**
- `frontend/lib/gallup-data.ts` — fix 3 wrong PL talent names
- `frontend/next.config.ts` — add `createNextIntlPlugin`
- `frontend/app/layout.tsx` — async server component with `NextIntlClientProvider`
- `frontend/lib/api.ts` — add `language` to `User` interface and `UserUpdateData`
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/register/page.tsx`
- `frontend/app/(auth)/forgot-password/page.tsx`
- `frontend/app/(auth)/reset-password/page.tsx`
- `frontend/app/(auth)/join/page.tsx`
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/app/(dashboard)/dashboard/page.tsx`
- `frontend/app/(dashboard)/dashboard/settings/page.tsx`
- `frontend/app/(dashboard)/dashboard/my-talents/page.tsx`
- `frontend/app/(dashboard)/dashboard/teams/page.tsx`
- `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx`
- `frontend/app/(dashboard)/dashboard/users/page.tsx`
- `frontend/app/(dashboard)/dashboard/users/[id]/page.tsx`
- `frontend/app/(dashboard)/dashboard/compare/page.tsx`
- `frontend/app/(dashboard)/dashboard/qa/page.tsx`
- `frontend/app/(dashboard)/dashboard/tips/page.tsx`
- `frontend/app/(dashboard)/dashboard/organizations/page.tsx`
- `frontend/app/(dashboard)/dashboard/organizations/[id]/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/settings/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/knowledge/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/users/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/knowledge/instructions/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/knowledge/faq/page.tsx`
- `frontend/app/(dashboard)/dashboard/admin/knowledge/merytoryka/page.tsx`
- `frontend/components/dashboard/DomainChart.tsx`
- `frontend/components/dashboard/MatrixDashboard.tsx`
- `frontend/components/dashboard/TalentBadge.tsx`
- `frontend/components/dashboard/TeamGrid.tsx`
- `frontend/components/dashboard/UserManualCard.tsx`
- `frontend/components/qa/QAComponents.tsx`
- `frontend/components/qa/QARenderers.tsx`
- `frontend/components/talent-import/TalentImportDialog.tsx`
- `frontend/components/talent-import/ManualTalentInput.tsx`
- `frontend/components/knowledge/KnowledgeEntryManager.tsx`

---

## Task 1: Backend — User.language migration + schemas

**Files:**
- Create: `backend/alembic/versions/k5f6g7h8i9j0_add_language_to_user.py`
- Modify: `backend/models.py`
- Modify: `backend/schemas.py`

- [ ] **Step 1: Create Alembic migration**

Create `backend/alembic/versions/k5f6g7h8i9j0_add_language_to_user.py`:

```python
"""Add language field to User model

Revision ID: k5f6g7h8i9j0
Revises: j5e6f7g8h9i0
Create Date: 2026-05-29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k5f6g7h8i9j0'
down_revision: Union[str, None] = 'j5e6f7g8h9i0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    if 'users' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('users')]
        if 'language' not in columns:
            op.add_column('users', sa.Column(
                'language', sa.String(10), nullable=False, server_default='pl'
            ))


def downgrade() -> None:
    op.drop_column('users', 'language')
```

- [ ] **Step 2: Add `language` column to User model**

In `backend/models.py`, after the `feedback_style_en` column (~line 108), add:

```python
    language = Column(String(10), nullable=False, default="pl")
```

- [ ] **Step 3: Update `UserUpdate` schema**

In `backend/schemas.py`, in `class UserUpdate` (~line 72), add after `public_slug`:

```python
    language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')
```

- [ ] **Step 4: Update `UserResponse` schema**

In `backend/schemas.py`, in `class UserResponse` (~line 104), add after `public_slug`:

```python
    language: str = "pl"
```

- [ ] **Step 5: Run migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade j5e6f7g8h9i0 -> k5f6g7h8i9j0, Add language field to User model`

- [ ] **Step 6: Smoke test — verify field is returned from /api/users/me**

```bash
cd backend && python -c "
from database import SessionLocal
from models import User
db = SessionLocal()
u = db.query(User).first()
print('language field:', u.language)
db.close()
"
```

Expected: `language field: pl`

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/k5f6g7h8i9j0_add_language_to_user.py backend/models.py backend/schemas.py
git commit -m "feat(backend): add language field to User model and schemas"
```

---

## Task 2: Backend — AI endpoints respect user language

**Files:**
- Modify: `backend/routers/qa.py`
- Modify: `backend/routers/tips.py`
- Modify: `backend/routers/compare.py`
- Modify: `backend/routers/dashboard.py`

- [ ] **Step 1: Update QA router — fall back to user's language**

In `backend/routers/qa.py`, line ~101, change:

```python
# Before
language = request.language or "pl"

# After
language = request.language or current_user.language or "pl"
```

- [ ] **Step 2: Update Tips router — pass user language to service**

In `backend/routers/tips.py`, the `get_daily_tip` handler (~line 18), change:

```python
# Before
result = generate_daily_tip(db, current_user, context=context)

# After
result = generate_daily_tip(db, current_user, context=context, language=current_user.language or "pl")
```

In the `get_synergy_tip` handler (~line 35), change:

```python
# Before
result = generate_synergy_tip(db, current_user, target_user)

# After
result = generate_synergy_tip(db, current_user, target_user, language=current_user.language or "pl")
```

- [ ] **Step 3: Update Compare router — use user language as default**

In `backend/routers/compare.py`, the compare endpoint (~line 18), change the `language` query param default:

```python
# Before
language: str = Query("pl", description="Language for talent names"),

# After
language: Optional[str] = Query(None, description="Language for talent names"),
```

Then after the parameter, add:

```python
    language = language or current_user.language or "pl"
```

Add `Optional` import if not present: `from typing import Optional`

- [ ] **Step 4: Commit**

```bash
git add backend/routers/qa.py backend/routers/tips.py backend/routers/compare.py
git commit -m "feat(backend): AI endpoints respect current_user.language"
```

---

## Task 3: Frontend — Fix wrong PL talent names in gallup-data.ts

**Files:**
- Modify: `frontend/lib/gallup-data.ts`

Three PL names in `gallup-data.ts` don't match the backend's authoritative `seed_talents.py`.

- [ ] **Step 1: Fix the three wrong PL names**

In `frontend/lib/gallup-data.ts`, make these changes:

```typescript
// Line ~66: consistency
{ code: 'consistency', en: 'Consistency', pl: 'Sprawiedliwość', ... }
// was: pl: 'Bezstronność'

// Line ~79: self-assurance
{ code: 'self-assurance', en: 'Self-Assurance', pl: 'Pewność siebie', ... }
// was: pl: 'Wiara w siebie'

// Line ~86: developer
{ code: 'developer', en: 'Developer', pl: 'Rozwijanie', ... }
// was: pl: 'Rozwijanie innych'
```

Also fix `DOMAIN_LABELS` to match the canonical translations used in `aboutme/page.tsx`:

```typescript
export const DOMAIN_LABELS: Record<GallupDomain, { en: string; pl: string }> = {
    executing: { en: 'Executing', pl: 'Realizowanie' },
    influencing: { en: 'Influencing', pl: 'Wywieranie wpływu' },
    relationship_building: { en: 'Relationship Building', pl: 'Budowanie relacji' },
    strategic_thinking: { en: 'Strategic Thinking', pl: 'Myślenie strategiczne' },
};
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to gallup-data.ts

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/gallup-data.ts
git commit -m "fix(frontend): correct 3 wrong PL talent names and domain labels in gallup-data.ts"
```

---

## Task 4: Frontend — next-intl infrastructure

**Files:**
- Create: `frontend/i18n/request.ts`
- Modify: `frontend/next.config.ts`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create i18n/request.ts**

Create `frontend/i18n/request.ts`:

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value ?? 'pl';
  const validLocale = ['pl', 'en'].includes(locale) ? locale : 'pl';

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});
```

- [ ] **Step 2: Update next.config.ts to add next-intl plugin**

In `frontend/next.config.ts`, replace the current content with:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [],
  allowedDevOrigins: ["app.talentpilot.io", "localhost:3000"],
  async redirects() {
    return [
      {
        source: "/accept-invitation",
        destination: "/join",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3: Update root layout.tsx to async server component with provider**

Replace `frontend/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import PwaManager from "@/components/pwa/PwaManager";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "TalentPilot - Manager Copilot",
  description: "Transform talents into actionable insights with CliftonStrengths",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TalentPilot",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <PwaManager />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles (before message files exist, expect import error)**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "messages/" | head -20
```

Expected: Only errors about missing `messages/pl.json` and `messages/en.json` — that's fine, they'll be created in Task 5.

- [ ] **Step 5: Commit**

```bash
git add frontend/i18n/request.ts frontend/next.config.ts frontend/app/layout.tsx
git commit -m "feat(frontend): configure next-intl without URL routing"
```

---

## Task 5: Frontend — Create pl.json and en.json message files

**Files:**
- Create: `frontend/messages/pl.json`
- Create: `frontend/messages/en.json`

These files contain all UI strings for all 26 pages and shared components. They must be created together (same key structure).

- [ ] **Step 1: Create frontend/messages/pl.json**

```bash
mkdir -p frontend/messages
```

Create `frontend/messages/pl.json`:

```json
{
  "common": {
    "save": "Zapisz",
    "saving": "Zapisywanie...",
    "cancel": "Anuluj",
    "delete": "Usuń",
    "deleting": "Usuwanie...",
    "add": "Dodaj",
    "edit": "Edytuj",
    "loading": "Ładowanie...",
    "error": "Wystąpił błąd",
    "back": "Wróć",
    "close": "Zamknij",
    "confirm": "Potwierdź",
    "yes": "Tak",
    "no": "Nie",
    "search": "Szukaj",
    "refresh": "Odśwież",
    "copy": "Kopiuj",
    "copied": "Skopiowano",
    "generate": "Generuj",
    "generating": "Generowanie...",
    "unknown": "Nieznany",
    "notFound": "Nie znaleziono",
    "tryAgain": "Spróbuj ponownie"
  },
  "auth": {
    "login": {
      "title": "Witaj ponownie",
      "subtitle": "Zaloguj się, aby zarządzać talentami swojego zespołu",
      "emailLabel": "Email",
      "passwordLabel": "Hasło",
      "showPassword": "Pokaż hasło",
      "hidePassword": "Ukryj hasło",
      "submit": "Zaloguj się",
      "loading": "Logowanie...",
      "forgotPassword": "Nie pamiętam hasła"
    },
    "register": {
      "title": "Stwórz konto",
      "subtitle": "Dołącz do TalentPilot i odkryj talenty swojego zespołu",
      "nameLabel": "Imię i nazwisko",
      "emailLabel": "Email",
      "passwordLabel": "Hasło",
      "submit": "Utwórz konto",
      "loading": "Tworzenie konta...",
      "alreadyHaveAccount": "Masz już konto?",
      "signIn": "Zaloguj się"
    },
    "forgotPassword": {
      "title": "Nie pamiętam hasła",
      "subtitle": "Podaj swój email, a wyślemy Ci link do resetowania hasła",
      "emailLabel": "Email",
      "submit": "Wyślij link",
      "loading": "Wysyłanie...",
      "successTitle": "Sprawdź skrzynkę",
      "successMessage": "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.",
      "backToLogin": "Wróć do logowania"
    },
    "resetPassword": {
      "title": "Nowe hasło",
      "subtitle": "Ustaw nowe hasło dla swojego konta",
      "passwordLabel": "Nowe hasło",
      "confirmLabel": "Potwierdź hasło",
      "submit": "Ustaw hasło",
      "loading": "Ustawianie...",
      "successMessage": "Hasło zostało zmienione. Możesz się zalogować.",
      "backToLogin": "Wróć do logowania"
    },
    "join": {
      "title": "Przyjmij zaproszenie",
      "subtitle": "Zostałeś zaproszony do zespołu w TalentPilot",
      "nameLabel": "Imię i nazwisko",
      "passwordLabel": "Hasło",
      "submit": "Dołącz do zespołu",
      "loading": "Dołączanie...",
      "invalidToken": "Link zaproszenia jest nieprawidłowy lub wygasł."
    }
  },
  "nav": {
    "overview": "Przegląd",
    "myTalents": "Moje talenty",
    "teams": "Zespół",
    "compare": "Porównanie 1:1",
    "qa": "Asystent AI",
    "tips": "Wskazówki",
    "settings": "Ustawienia",
    "organizations": "Organizacje",
    "adminSettings": "Ustawienia AI",
    "adminUsers": "Użytkownicy i dostępy",
    "adminKnowledge": "Baza wiedzy",
    "logout": "Wyloguj",
    "myOrg": "Moja Organizacja"
  },
  "dashboard": {
    "greeting": "Cześć, {name}!",
    "greetingFallback": "Cześć!",
    "teamMembers": "Członków zespołu",
    "importedTalents": "Zaimportowane talenty",
    "talentCoverage": "Pokrycie talentami",
    "talentDistribution": "Rozkład talentów",
    "loadError": "Nie udało się załadować danych. Spróbuj odświeżyć stronę.",
    "noTalents": "Brak talentów",
    "viewAll": "Zobacz wszystkich",
    "addTalents": "Dodaj talenty",
    "roleAdmin": "Administrator",
    "roleManager": "Menedżer",
    "roleUser": "Członek zespołu",
    "roleCoach": "Coach",
    "domains": {
      "executing": "Realizowanie",
      "influencing": "Wywieranie wpływu",
      "relationship_building": "Budowanie relacji",
      "strategic_thinking": "Myślenie strategiczne"
    }
  },
  "myTalents": {
    "title": "Moje talenty",
    "importTalents": "Importuj talenty",
    "noTalentsTitle": "Nie masz jeszcze talentów",
    "noTalentsDesc": "Zaimportuj swój raport Gallup, aby zobaczyć talenty.",
    "viewTop5": "Top 5",
    "viewTop15": "Top 15",
    "viewAll": "Wszystkie 34",
    "viewBottom5": "Ostatnie 5",
    "userManual": "Instrukcja obsługi",
    "superpowers": "Moje supermoce",
    "motivators": "Motywatory",
    "blockers": "Blokady",
    "feedbackStyle": "Jak mi dawać feedback",
    "editManual": "Edytuj instrukcję",
    "generateManual": "Generuj z AI",
    "translateManual": "Przetłumacz na EN",
    "manualPlaceholder": "Opisz siebie w tym obszarze...",
    "manualEmpty": "Nie wypełniono",
    "saveManual": "Zapisz instrukcję",
    "aiGenerating": "AI generuje instrukcję...",
    "aiTranslating": "Tłumaczenie...",
    "talentRank": "#{rank}"
  },
  "teams": {
    "title": "Zespoły",
    "createTeam": "Utwórz zespół",
    "noTeams": "Nie należysz do żadnego zespołu",
    "members": "Członkowie",
    "manager": "Menedżer",
    "noManager": "Brak menedżera",
    "viewTeam": "Zobacz zespół",
    "teamName": "Nazwa zespołu",
    "teamDescription": "Opis",
    "addMember": "Dodaj członka",
    "removeMember": "Usuń z zespołu",
    "deleteTeam": "Usuń zespół",
    "editTeam": "Edytuj zespół",
    "inviteByEmail": "Zaproś przez email",
    "presentationLink": "Link do prezentacji",
    "copyLink": "Kopiuj link",
    "matrixView": "Macierz talentów",
    "listView": "Lista",
    "noMembers": "Brak członków zespołu",
    "inviteGhost": "Dodaj profil",
    "domainBalance": "Balans domen",
    "topTalents": "Top talenty zespołu",
    "confirmDeleteTeam": "Czy na pewno chcesz usunąć ten zespół?",
    "confirmRemoveMember": "Czy na pewno chcesz usunąć tego członka?"
  },
  "users": {
    "title": "Użytkownicy",
    "addUser": "Dodaj użytkownika",
    "noUsers": "Brak użytkowników",
    "name": "Imię i nazwisko",
    "email": "Email",
    "role": "Rola",
    "status": "Status",
    "active": "Aktywny",
    "inactive": "Nieaktywny",
    "viewProfile": "Zobacz profil",
    "editUser": "Edytuj użytkownika",
    "deleteUser": "Usuń użytkownika",
    "confirmDelete": "Czy na pewno chcesz usunąć tego użytkownika?",
    "talents": "Talenty",
    "noTalents": "Brak talentów",
    "compareWith": "Porównaj z",
    "sendTip": "Wyślij wskazówkę"
  },
  "compare": {
    "title": "Porównanie 1:1",
    "selectUserA": "Osoba A",
    "selectUserB": "Osoba B",
    "swap": "Zamień miejscami",
    "compare": "Porównaj",
    "comparing": "Porównywanie...",
    "sharedTalents": "Wspólne talenty",
    "complementaryTalents": "Talenty uzupełniające",
    "collaborationTips": "Wskazówki współpracy",
    "synergyScore": "Synergia",
    "highSynergy": "Wysoka synergia",
    "mediumSynergy": "Umiarkowana synergia",
    "lowSynergy": "Potencjał do rozwoju",
    "noResult": "Wybierz dwie osoby, aby porównać talenty",
    "domainExecuting": "Realizowanie",
    "domainInfluencing": "Wywieranie wpływu",
    "domainRelationship": "Budowanie relacji",
    "domainStrategic": "Myślenie strategiczne"
  },
  "qa": {
    "title": "Asystent AI",
    "placeholder": "Zadaj pytanie o talenty...",
    "send": "Wyślij",
    "sending": "Wysyłanie...",
    "aboutWho": "O kim pytasz?",
    "aboutMe": "O sobie",
    "talent": "Talent",
    "competency": "Kompetencja",
    "actions": "Działania",
    "history": "Historia pytań",
    "noHistory": "Brak historii pytań",
    "helpful": "Pomocne",
    "notHelpful": "Niepomocne",
    "feedbackSent": "Dziękujemy za ocenę!",
    "errorGeneric": "Nie udało się uzyskać odpowiedzi. Spróbuj ponownie."
  },
  "tips": {
    "title": "Wskazówki",
    "daily": "Wskazówka na dziś",
    "synergy": "Wskazówka relacyjna",
    "context": {
      "general": "Ogólna",
      "feedback": "Feedback",
      "one_on_one": "1:1",
      "conflict": "Konflikt",
      "motivation": "Motywacja"
    },
    "generate": "Generuj wskazówkę",
    "generating": "Generowanie...",
    "helpful": "Pomocne",
    "notHelpful": "Niepomocne",
    "selectMember": "Wybierz członka zespołu",
    "noTalents": "Brak talentów do generowania wskazówki"
  },
  "settings": {
    "title": "Ustawienia",
    "profile": "Profil",
    "account": "Konto",
    "notifications": "Powiadomienia",
    "privacy": "Prywatność",
    "language": {
      "title": "Język aplikacji",
      "pl": "Polski",
      "en": "English",
      "saving": "Zapisywanie..."
    },
    "firstName": "Imię",
    "lastName": "Nazwisko",
    "fullName": "Imię i nazwisko",
    "jobTitle": "Stanowisko",
    "jobTitleEn": "Stanowisko (EN)",
    "phone": "Telefon",
    "linkedin": "LinkedIn",
    "avatar": "Zdjęcie profilowe",
    "changeAvatar": "Zmień zdjęcie",
    "uploadAvatar": "Prześlij zdjęcie",
    "publicProfile": "Publiczny profil",
    "publicLink": "Link publiczny",
    "copyLink": "Kopiuj link",
    "linkCopied": "Skopiowano!",
    "customSlug": "Własny adres",
    "changePassword": "Zmień hasło",
    "currentPassword": "Obecne hasło",
    "newPassword": "Nowe hasło",
    "confirmPassword": "Potwierdź hasło",
    "savePassword": "Zmień hasło",
    "organization": "Organizacja",
    "orgName": "Nazwa organizacji",
    "orgAddress": "Adres",
    "saveProfile": "Zapisz profil",
    "saveOrg": "Zapisz organizację",
    "talentImport": "Import talentów",
    "importButton": "Importuj talenty"
  },
  "organizations": {
    "title": "Organizacje",
    "create": "Utwórz organizację",
    "name": "Nazwa",
    "members": "Członkowie",
    "teams": "Zespoły",
    "view": "Zarządzaj",
    "noOrgs": "Brak organizacji"
  },
  "admin": {
    "settings": {
      "title": "Ustawienia AI",
      "systemPrompt": "Prompt systemowy",
      "save": "Zapisz ustawienia",
      "saving": "Zapisywanie..."
    },
    "knowledge": {
      "title": "Baza wiedzy",
      "add": "Dodaj wpis",
      "category": "Kategoria",
      "language": "Język",
      "content": "Treść",
      "tags": "Tagi",
      "noItems": "Brak wpisów w bazie wiedzy"
    },
    "users": {
      "title": "Użytkownicy i dostępy",
      "addUser": "Dodaj użytkownika",
      "noUsers": "Brak użytkowników"
    }
  },
  "talentImport": {
    "title": "Importuj talenty",
    "pdfTab": "Z pliku PDF",
    "manualTab": "Ręcznie",
    "dropzone": "Przeciągnij plik PDF lub kliknij, aby wybrać",
    "uploading": "Przesyłanie...",
    "processing": "Przetwarzanie...",
    "success": "Talenty zaimportowane pomyślnie!",
    "error": "Nie udało się zaimportować talentów",
    "save": "Zapisz talenty",
    "saving": "Zapisywanie...",
    "rank": "Pozycja",
    "talent": "Talent"
  }
}
```

- [ ] **Step 2: Create frontend/messages/en.json**

Create `frontend/messages/en.json`:

```json
{
  "common": {
    "save": "Save",
    "saving": "Saving...",
    "cancel": "Cancel",
    "delete": "Delete",
    "deleting": "Deleting...",
    "add": "Add",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "An error occurred",
    "back": "Back",
    "close": "Close",
    "confirm": "Confirm",
    "yes": "Yes",
    "no": "No",
    "search": "Search",
    "refresh": "Refresh",
    "copy": "Copy",
    "copied": "Copied",
    "generate": "Generate",
    "generating": "Generating...",
    "unknown": "Unknown",
    "notFound": "Not found",
    "tryAgain": "Try again"
  },
  "auth": {
    "login": {
      "title": "Welcome back",
      "subtitle": "Sign in to manage your team's talents",
      "emailLabel": "Email",
      "passwordLabel": "Password",
      "showPassword": "Show password",
      "hidePassword": "Hide password",
      "submit": "Sign in",
      "loading": "Signing in...",
      "forgotPassword": "Forgot password"
    },
    "register": {
      "title": "Create an account",
      "subtitle": "Join TalentPilot and discover your team's talents",
      "nameLabel": "Full name",
      "emailLabel": "Email",
      "passwordLabel": "Password",
      "submit": "Create account",
      "loading": "Creating account...",
      "alreadyHaveAccount": "Already have an account?",
      "signIn": "Sign in"
    },
    "forgotPassword": {
      "title": "Forgot password",
      "subtitle": "Enter your email and we'll send you a reset link",
      "emailLabel": "Email",
      "submit": "Send reset link",
      "loading": "Sending...",
      "successTitle": "Check your inbox",
      "successMessage": "If the account exists, we sent a password reset link.",
      "backToLogin": "Back to login"
    },
    "resetPassword": {
      "title": "New password",
      "subtitle": "Set a new password for your account",
      "passwordLabel": "New password",
      "confirmLabel": "Confirm password",
      "submit": "Set password",
      "loading": "Setting...",
      "successMessage": "Password changed. You can now sign in.",
      "backToLogin": "Back to login"
    },
    "join": {
      "title": "Accept invitation",
      "subtitle": "You've been invited to a team on TalentPilot",
      "nameLabel": "Full name",
      "passwordLabel": "Password",
      "submit": "Join team",
      "loading": "Joining...",
      "invalidToken": "The invitation link is invalid or has expired."
    }
  },
  "nav": {
    "overview": "Overview",
    "myTalents": "My Talents",
    "teams": "Teams",
    "compare": "Compare 1:1",
    "qa": "AI Assistant",
    "tips": "Tips",
    "settings": "Settings",
    "organizations": "Organizations",
    "adminSettings": "AI Settings",
    "adminUsers": "Users & Access",
    "adminKnowledge": "Knowledge Base",
    "logout": "Logout",
    "myOrg": "My Organization"
  },
  "dashboard": {
    "greeting": "Hi, {name}!",
    "greetingFallback": "Hi!",
    "teamMembers": "Team Members",
    "importedTalents": "Imported Talents",
    "talentCoverage": "Talent Coverage",
    "talentDistribution": "Talent Distribution",
    "loadError": "Failed to load data. Try refreshing the page.",
    "noTalents": "No talents",
    "viewAll": "View all",
    "addTalents": "Add talents",
    "roleAdmin": "Administrator",
    "roleManager": "Manager",
    "roleUser": "Team Member",
    "roleCoach": "Coach",
    "domains": {
      "executing": "Executing",
      "influencing": "Influencing",
      "relationship_building": "Relationship Building",
      "strategic_thinking": "Strategic Thinking"
    }
  },
  "myTalents": {
    "title": "My Talents",
    "importTalents": "Import Talents",
    "noTalentsTitle": "No talents yet",
    "noTalentsDesc": "Import your Gallup report to see your talents.",
    "viewTop5": "Top 5",
    "viewTop15": "Top 15",
    "viewAll": "All 34",
    "viewBottom5": "Bottom 5",
    "userManual": "User Manual",
    "superpowers": "My Superpowers",
    "motivators": "Motivators",
    "blockers": "Blockers",
    "feedbackStyle": "How to give me feedback",
    "editManual": "Edit manual",
    "generateManual": "Generate with AI",
    "translateManual": "Translate to EN",
    "manualPlaceholder": "Describe yourself in this area...",
    "manualEmpty": "Not filled in",
    "saveManual": "Save manual",
    "aiGenerating": "AI is generating your manual...",
    "aiTranslating": "Translating...",
    "talentRank": "#{rank}"
  },
  "teams": {
    "title": "Teams",
    "createTeam": "Create team",
    "noTeams": "You don't belong to any team",
    "members": "Members",
    "manager": "Manager",
    "noManager": "No manager",
    "viewTeam": "View team",
    "teamName": "Team name",
    "teamDescription": "Description",
    "addMember": "Add member",
    "removeMember": "Remove from team",
    "deleteTeam": "Delete team",
    "editTeam": "Edit team",
    "inviteByEmail": "Invite by email",
    "presentationLink": "Presentation link",
    "copyLink": "Copy link",
    "matrixView": "Talent matrix",
    "listView": "List",
    "noMembers": "No team members",
    "inviteGhost": "Add profile",
    "domainBalance": "Domain balance",
    "topTalents": "Team top talents",
    "confirmDeleteTeam": "Are you sure you want to delete this team?",
    "confirmRemoveMember": "Are you sure you want to remove this member?"
  },
  "users": {
    "title": "Users",
    "addUser": "Add user",
    "noUsers": "No users",
    "name": "Full name",
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "active": "Active",
    "inactive": "Inactive",
    "viewProfile": "View profile",
    "editUser": "Edit user",
    "deleteUser": "Delete user",
    "confirmDelete": "Are you sure you want to delete this user?",
    "talents": "Talents",
    "noTalents": "No talents",
    "compareWith": "Compare with",
    "sendTip": "Send tip"
  },
  "compare": {
    "title": "Compare 1:1",
    "selectUserA": "Person A",
    "selectUserB": "Person B",
    "swap": "Swap",
    "compare": "Compare",
    "comparing": "Comparing...",
    "sharedTalents": "Shared talents",
    "complementaryTalents": "Complementary talents",
    "collaborationTips": "Collaboration tips",
    "synergyScore": "Synergy",
    "highSynergy": "High synergy",
    "mediumSynergy": "Moderate synergy",
    "lowSynergy": "Growth potential",
    "noResult": "Select two people to compare talents",
    "domainExecuting": "Executing",
    "domainInfluencing": "Influencing",
    "domainRelationship": "Relationship Building",
    "domainStrategic": "Strategic Thinking"
  },
  "qa": {
    "title": "AI Assistant",
    "placeholder": "Ask a question about talents...",
    "send": "Send",
    "sending": "Sending...",
    "aboutWho": "Who are you asking about?",
    "aboutMe": "Myself",
    "talent": "Talent",
    "competency": "Competency",
    "actions": "Actions",
    "history": "Question history",
    "noHistory": "No question history",
    "helpful": "Helpful",
    "notHelpful": "Not helpful",
    "feedbackSent": "Thanks for your feedback!",
    "errorGeneric": "Failed to get a response. Please try again."
  },
  "tips": {
    "title": "Tips",
    "daily": "Today's tip",
    "synergy": "Relationship tip",
    "context": {
      "general": "General",
      "feedback": "Feedback",
      "one_on_one": "1:1",
      "conflict": "Conflict",
      "motivation": "Motivation"
    },
    "generate": "Generate tip",
    "generating": "Generating...",
    "helpful": "Helpful",
    "notHelpful": "Not helpful",
    "selectMember": "Select a team member",
    "noTalents": "No talents available for tip generation"
  },
  "settings": {
    "title": "Settings",
    "profile": "Profile",
    "account": "Account",
    "notifications": "Notifications",
    "privacy": "Privacy",
    "language": {
      "title": "App language",
      "pl": "Polish",
      "en": "English",
      "saving": "Saving..."
    },
    "firstName": "First name",
    "lastName": "Last name",
    "fullName": "Full name",
    "jobTitle": "Job title",
    "jobTitleEn": "Job title (EN)",
    "phone": "Phone",
    "linkedin": "LinkedIn",
    "avatar": "Profile photo",
    "changeAvatar": "Change photo",
    "uploadAvatar": "Upload photo",
    "publicProfile": "Public profile",
    "publicLink": "Public link",
    "copyLink": "Copy link",
    "linkCopied": "Copied!",
    "customSlug": "Custom URL",
    "changePassword": "Change password",
    "currentPassword": "Current password",
    "newPassword": "New password",
    "confirmPassword": "Confirm password",
    "savePassword": "Change password",
    "organization": "Organization",
    "orgName": "Organization name",
    "orgAddress": "Address",
    "saveProfile": "Save profile",
    "saveOrg": "Save organization",
    "talentImport": "Import talents",
    "importButton": "Import talents"
  },
  "organizations": {
    "title": "Organizations",
    "create": "Create organization",
    "name": "Name",
    "members": "Members",
    "teams": "Teams",
    "view": "Manage",
    "noOrgs": "No organizations"
  },
  "admin": {
    "settings": {
      "title": "AI Settings",
      "systemPrompt": "System prompt",
      "save": "Save settings",
      "saving": "Saving..."
    },
    "knowledge": {
      "title": "Knowledge Base",
      "add": "Add entry",
      "category": "Category",
      "language": "Language",
      "content": "Content",
      "tags": "Tags",
      "noItems": "No knowledge base entries"
    },
    "users": {
      "title": "Users & Access",
      "addUser": "Add user",
      "noUsers": "No users"
    }
  },
  "talentImport": {
    "title": "Import Talents",
    "pdfTab": "From PDF",
    "manualTab": "Manual",
    "dropzone": "Drag a PDF file or click to select",
    "uploading": "Uploading...",
    "processing": "Processing...",
    "success": "Talents imported successfully!",
    "error": "Failed to import talents",
    "save": "Save talents",
    "saving": "Saving...",
    "rank": "Rank",
    "talent": "Talent"
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): add pl.json and en.json translation message files"
```

---

## Task 6: Frontend — locale helper + api.ts User interface

**Files:**
- Create: `frontend/lib/locale.ts`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Create frontend/lib/locale.ts**

Create `frontend/lib/locale.ts`:

```typescript
export type Locale = 'pl' | 'en';

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'pl';
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return (match?.[1] as Locale) ?? 'pl';
}

export function setLocale(lang: Locale): void {
  document.cookie = `locale=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}
```

- [ ] **Step 2: Add `language` to User interface in api.ts**

In `frontend/lib/api.ts`, in `interface User` (~line 12), add after `public_slug`:

```typescript
    language?: string;
```

- [ ] **Step 3: Add `language` to UserUpdateData interface in api.ts**

In `frontend/lib/api.ts`, in `interface UserUpdateData` (~line 59), add after `feedback_style_en`:

```typescript
    language?: string;
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/locale.ts frontend/lib/api.ts
git commit -m "feat(frontend): add locale helper and language field to User interface"
```

---

## Task 7: Frontend — Auth pages use translations + set locale on login

**Files:**
- Modify: `frontend/app/(auth)/login/page.tsx`
- Modify: `frontend/app/(auth)/register/page.tsx`
- Modify: `frontend/app/(auth)/forgot-password/page.tsx`
- Modify: `frontend/app/(auth)/reset-password/page.tsx`
- Modify: `frontend/app/(auth)/join/page.tsx`

**Pattern for all auth pages:**
1. Add `import { useTranslations } from 'next-intl';` at top
2. Inside component: `const t = useTranslations('auth.login');` (or relevant namespace)
3. Replace hardcoded Polish strings with `t('key')`

- [ ] **Step 1: Update login/page.tsx — set locale on login + translations**

In `frontend/app/(auth)/login/page.tsx`:

Add imports at top:
```typescript
import { useTranslations } from 'next-intl';
import { setLocale } from '@/lib/locale';
```

Inside `LoginPage()`, add:
```typescript
const t = useTranslations('auth.login');
```

In `handleSubmit`, after `tokenManager.setUser(user)`, add:
```typescript
if (user.language) {
  setLocale(user.language as 'pl' | 'en');
}
```

Replace hardcoded strings:
```tsx
// title
<h1 className="text-headline mb-2">{t('title')}</h1>
<p className="text-body">{t('subtitle')}</p>

// email label
<label htmlFor="email" ...>{t('emailLabel')}</label>

// password label
<label htmlFor="password" ...>{t('passwordLabel')}</label>

// submit button
<button type="submit" ...>
  {loading ? t('loading') : t('submit')}
</button>

// forgot password link
<Link href="/forgot-password">{t('forgotPassword')}</Link>
```

- [ ] **Step 2: Update register/page.tsx**

Add imports and `const t = useTranslations('auth.register');`

Replace strings:
```tsx
<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
// labels: t('nameLabel'), t('emailLabel'), t('passwordLabel')
// button: loading ? t('loading') : t('submit')
// link: t('alreadyHaveAccount') ... t('signIn')
```

- [ ] **Step 3: Update forgot-password/page.tsx**

Add imports and `const t = useTranslations('auth.forgotPassword');`

Replace strings with `t('title')`, `t('subtitle')`, `t('emailLabel')`, `t('submit')`, `t('loading')`, `t('successTitle')`, `t('successMessage')`, `t('backToLogin')`.

- [ ] **Step 4: Update reset-password/page.tsx**

Add imports and `const t = useTranslations('auth.resetPassword');`

Replace strings with `t('title')`, `t('subtitle')`, `t('passwordLabel')`, `t('confirmLabel')`, `t('submit')`, `t('loading')`, `t('successMessage')`, `t('backToLogin')`.

- [ ] **Step 5: Update join/page.tsx**

Add imports and `const t = useTranslations('auth.join');`

Replace strings with `t('title')`, `t('subtitle')`, `t('nameLabel')`, `t('passwordLabel')`, `t('submit')`, `t('loading')`, `t('invalidToken')`.

After successful join and login, also call `setLocale(user.language as 'pl' | 'en')` (same as login page).

- [ ] **Step 6: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/(auth)/"
git commit -m "feat(frontend): auth pages use next-intl translations, set locale on login"
```

---

## Task 8: Frontend — Dashboard layout navigation

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx`

The dashboard layout has hardcoded nav item names and role labels.

- [ ] **Step 1: Add translations to dashboard layout**

In `frontend/app/(dashboard)/layout.tsx`:

Add import at top (after existing imports):
```typescript
import { useTranslations } from 'next-intl';
```

Inside `DashboardLayout`, add:
```typescript
const t = useTranslations('nav');
const tDash = useTranslations('dashboard');
```

Find the nav items array (~line 120) and replace hardcoded strings:
```typescript
const navItems = [
    { name: t('myTalents'), href: "/dashboard/my-talents", icon: Sparkles },
    { name: t('qa'), href: "/dashboard/qa", icon: MessageSquare },
    { name: t('teams'), href: "/dashboard/teams", icon: Users },
    { name: t('compare'), href: "/dashboard/compare", icon: GitCompare },
    { name: t('tips'), href: "/dashboard/tips", icon: Zap },
    { name: t('settings'), href: "/dashboard/settings", icon: Settings },
];

const adminNavItems = [
    { name: t('organizations'), href: "/dashboard/organizations", icon: Building },
    { name: t('adminSettings'), href: "/dashboard/admin/settings", icon: Shield },
    { name: t('adminUsers'), href: "/dashboard/admin/users", icon: Users },
];
```

Find the logout button and update:
```tsx
<button onClick={handleLogout} ...>{t('logout')}</button>
```

Find role labels and replace:
```typescript
function getRoleLabel(role: string): string {
    const tDash = useTranslations('dashboard');
    switch (role) {
        case 'admin': return tDash('roleAdmin');
        case 'manager': return tDash('roleManager');
        case 'coach': return tDash('roleCoach');
        default: return tDash('roleUser');
    }
}
```

Note: If `getRoleLabel` is defined outside the component, move it inside or pass `tDash` as a parameter.

- [ ] **Step 2: Commit**

```bash
git add "frontend/app/(dashboard)/layout.tsx"
git commit -m "feat(frontend): dashboard navigation uses next-intl translations"
```

---

## Task 9: Frontend — Dashboard overview page

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add translations to dashboard/page.tsx**

Add import:
```typescript
import { useTranslations } from 'next-intl';
```

Inside `DashboardPage()`, add:
```typescript
const t = useTranslations('dashboard');
```

Replace hardcoded strings:
```tsx
// Loading state
<p className="text-sm font-medium text-slate-500">{t('loading')}</p>
// use common.loading from useTranslations('common')

// Error state  
setError(t('loadError'));

// Greeting
const firstName = currentUser?.full_name?.split(" ")[0] || t('greetingFallback').replace('Hi, ', '').replace('!', '');
// Better: show t('greeting', { name: firstName }) or t('greetingFallback')

// KPI titles
<KPICard title={t('teamMembers')} ... />
<KPICard title={t('importedTalents')} ... />
<KPICard title={t('talentCoverage')} ... />

// Domain labels
<DomainProgress label={t('domains.executing')} ... />
<DomainProgress label={t('domains.influencing')} ... />
<DomainProgress label={t('domains.relationship_building')} ... />
<DomainProgress label={t('domains.strategic_thinking')} ... />

// Role labels
case 'admin': return t('roleAdmin');
case 'manager': return t('roleManager');
...
```

For the greeting with interpolation, use next-intl's interpolation:
```tsx
// In pl.json/en.json: "greeting": "Cześć, {name}!" / "Hi, {name}!"
<h1>{t('greeting', { name: firstName })}</h1>
```

Note: The `{name}` interpolation in next-intl requires ICU message syntax. If not already set up, use string concatenation as a simpler fallback:
```tsx
<h1>t('greetingFallback').replace('{name}', firstName)</h1>
```

Actually, next-intl supports `{name}` interpolation natively via `t('greeting', { name: firstName })`. Use that.

- [ ] **Step 2: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(frontend): dashboard overview page uses next-intl translations"
```

---

## Task 10: Frontend — Settings page + language switcher

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/settings/page.tsx`

This is the most important page — it contains the language switcher.

- [ ] **Step 1: Add translations and language state**

In `frontend/app/(dashboard)/dashboard/settings/page.tsx`:

Add imports:
```typescript
import { useTranslations } from 'next-intl';
import { setLocale, getLocaleFromCookie, type Locale } from '@/lib/locale';
import { useRouter } from 'next/navigation';
```

Inside `SettingsPage()`, add:
```typescript
const t = useTranslations('settings');
const router = useRouter();
const [currentLang, setCurrentLang] = useState<Locale>(getLocaleFromCookie());
const [langSaving, setLangSaving] = useState(false);
```

- [ ] **Step 2: Add handleLanguageChange function**

Inside `SettingsPage()`, add:
```typescript
const handleLanguageChange = async (lang: Locale) => {
  if (lang === currentLang || !currentUser) return;
  setLangSaving(true);
  try {
    await api.users.update(currentUser.id, { language: lang });
    setCurrentLang(lang);
    setLocale(lang);
    router.refresh();
  } catch {
    // silent fail — UI reverts automatically since state didn't change
  } finally {
    setLangSaving(false);
  }
};
```

- [ ] **Step 3: Add language switcher UI**

Find the profile section in the JSX (search for `SettingsSection` with profile-related content) and add the language switcher. It goes after the job title fields:

```tsx
{/* Language */}
<div>
  <p className="text-sm font-semibold text-slate-700 mb-2">{t('language.title')}</p>
  <div className="flex gap-2">
    <button
      onClick={() => handleLanguageChange('pl')}
      disabled={langSaving}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
        currentLang === 'pl'
          ? "bg-primary text-white border-primary"
          : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
      )}
    >
      {t('language.pl')}
    </button>
    <button
      onClick={() => handleLanguageChange('en')}
      disabled={langSaving}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
        currentLang === 'en'
          ? "bg-primary text-white border-primary"
          : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
      )}
    >
      {t('language.en')}
    </button>
    {langSaving && (
      <span className="text-sm text-slate-500 self-center">{t('language.saving')}</span>
    )}
  </div>
</div>
```

- [ ] **Step 4: Replace section titles and labels throughout settings page**

The settings page is 1263 lines. Replace the most visible hardcoded Polish strings. Search for Polish text with:

```bash
grep -n '"[A-ZĄĆĘŁŃÓŚŹŻ]' "frontend/app/(dashboard)/dashboard/settings/page.tsx" | head -40
```

Then replace each occurrence using `t('key')` with the appropriate key from `settings` namespace. Key replacements:

```tsx
// Section headers — look for strings like "Profil", "Konto", etc.
t('profile'), t('account'), t('notifications'), t('privacy')

// Field labels
t('fullName'), t('jobTitle'), t('jobTitleEn'), t('phone'), t('linkedin')
t('publicProfile'), t('publicLink'), t('copyLink'), t('linkCopied'), t('customSlug')
t('changePassword'), t('currentPassword'), t('newPassword'), t('confirmPassword'), t('savePassword')
t('organization'), t('orgName'), t('orgAddress')
t('saveProfile'), t('saveOrg')
t('talentImport'), t('importButton')
t('changeAvatar'), t('uploadAvatar')
```

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/settings/page.tsx"
git commit -m "feat(frontend): settings page — language switcher + translations"
```

---

## Task 11: Frontend — my-talents page + talent components

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/my-talents/page.tsx`
- Modify: `frontend/components/dashboard/TalentBadge.tsx`
- Modify: `frontend/components/dashboard/UserManualCard.tsx`

- [ ] **Step 1: Update my-talents/page.tsx**

Add import: `import { useTranslations } from 'next-intl';`

Inside component: `const t = useTranslations('myTalents');`

Key replacements:
```tsx
// Tab labels
t('viewTop5'), t('viewTop15'), t('viewAll'), t('viewBottom5')

// Empty state
<h3>{t('noTalentsTitle')}</h3>
<p>{t('noTalentsDesc')}</p>

// Import button
<Button onClick={() => setTalentImportOpen(true)}>{t('importTalents')}</Button>

// User manual section title
t('userManual')

// AI generate/translate buttons
t('generateManual'), t('translateManual'), t('aiGenerating'), t('aiTranslating')

// Save button
t('saveManual')

// Manual field placeholders
placeholder={t('manualPlaceholder')}
```

Also: when displaying talent names, prefer `talent.name_en` when `getLocaleFromCookie() === 'en'`, falling back to `talent.name_pl`. The `GALLUP_TALENTS` array in `gallup-data.ts` already has `pl` and `en` fields — use `locale === 'en' ? talent.en : talent.pl` pattern.

Add:
```typescript
import { getLocaleFromCookie } from '@/lib/locale';
const locale = getLocaleFromCookie();
// then use: locale === 'en' ? talentData.en : talentData.pl
```

- [ ] **Step 2: Update TalentBadge.tsx**

The `TalentBadge` component likely displays a talent name. Add locale awareness:

```typescript
import { getLocaleFromCookie } from '@/lib/locale';
```

In the component, where the talent name is displayed:
```tsx
const locale = getLocaleFromCookie();
const name = locale === 'en' ? talent.en : talent.pl;
```

- [ ] **Step 3: Update UserManualCard.tsx**

Add `import { useTranslations } from 'next-intl';`

Replace section headers `"Moje supermoce"`, `"Motywatory"`, etc. with:
```tsx
const t = useTranslations('myTalents');
// t('superpowers'), t('motivators'), t('blockers'), t('feedbackStyle')
```

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/my-talents/page.tsx" frontend/components/dashboard/TalentBadge.tsx frontend/components/dashboard/UserManualCard.tsx
git commit -m "feat(frontend): my-talents page and talent components use translations"
```

---

## Task 12: Frontend — Teams + DomainChart + MatrixDashboard + TeamGrid

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/teams/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx`
- Modify: `frontend/components/dashboard/DomainChart.tsx`
- Modify: `frontend/components/dashboard/MatrixDashboard.tsx`
- Modify: `frontend/components/dashboard/TeamGrid.tsx`

**Pattern** (same for all):
1. Add `import { useTranslations } from 'next-intl';`
2. Add `const t = useTranslations('teams');` (or `'dashboard'` for domain charts)
3. Replace hardcoded Polish strings

- [ ] **Step 1: Update teams/page.tsx**

```tsx
const t = useTranslations('teams');
// t('title'), t('createTeam'), t('noTeams'), t('members'), t('viewTeam')
```

- [ ] **Step 2: Update teams/[id]/page.tsx**

```tsx
const t = useTranslations('teams');
// t('manager'), t('noManager'), t('members'), t('addMember'), t('removeMember')
// t('deleteTeam'), t('editTeam'), t('presentationLink'), t('copyLink')
// t('domainBalance'), t('topTalents'), t('noMembers'), t('inviteGhost')
// t('confirmDeleteTeam'), t('confirmRemoveMember')
```

For talent names in team view, use locale-aware display:
```typescript
import { getLocaleFromCookie } from '@/lib/locale';
const locale = getLocaleFromCookie();
```

- [ ] **Step 3: Update DomainChart.tsx**

Domain labels should come from translations:
```tsx
const t = useTranslations('dashboard');
// t('domains.executing'), t('domains.influencing'), etc.
```

- [ ] **Step 4: Update MatrixDashboard.tsx**

```tsx
const t = useTranslations('dashboard');
// Use domain labels from t('domains.*')
```

- [ ] **Step 5: Update TeamGrid.tsx**

```tsx
const t = useTranslations('teams');
// Replace any hardcoded labels
```

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/teams/" frontend/components/dashboard/DomainChart.tsx frontend/components/dashboard/MatrixDashboard.tsx frontend/components/dashboard/TeamGrid.tsx
git commit -m "feat(frontend): teams pages and domain components use translations"
```

---

## Task 13: Frontend — Users + Compare pages

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/users/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/users/[id]/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/compare/page.tsx`

- [ ] **Step 1: Update users/page.tsx**

```tsx
const t = useTranslations('users');
// t('title'), t('addUser'), t('noUsers'), t('name'), t('email'), t('role')
// t('status'), t('active'), t('inactive'), t('viewProfile')
```

- [ ] **Step 2: Update users/[id]/page.tsx**

```tsx
const t = useTranslations('users');
const tMyTalents = useTranslations('myTalents');
// User profile labels, talent display
// For talent names: locale-aware from getLocaleFromCookie()
```

- [ ] **Step 3: Update compare/page.tsx**

The compare page currently hardcodes domain labels and synergy labels. Replace with translations:

```tsx
const t = useTranslations('compare');

// Domain config (currently hardcoded ~line 21)
const DOMAIN_CONFIG = {
    executing: { label: t('domainExecuting'), ... },
    influencing: { label: t('domainInfluencing'), ... },
    relationship_building: { label: t('domainRelationship'), ... },
    strategic_thinking: { label: t('domainStrategic'), ... },
};

// Synergy label (~line 36)
const label = score >= 70 ? t('highSynergy') : score >= 40 ? t('mediumSynergy') : t('lowSynergy');

// User selectors
<label>{t('selectUserA')}</label>
<label>{t('selectUserB')}</label>
<button title={t('swap')}>{t('swap')}</button>

// Section headers
<h3>{t('sharedTalents')}</h3>
<h3>{t('complementaryTalents')}</h3>
<h3>{t('collaborationTips')}</h3>
```

Also update the API call to send user's locale:
```typescript
import { getLocaleFromCookie } from '@/lib/locale';
// When calling compare:
const data = await api.compare.users(userAId, userBId, getLocaleFromCookie());
```

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/users/" "frontend/app/(dashboard)/dashboard/compare/page.tsx"
git commit -m "feat(frontend): users and compare pages use translations"
```

---

## Task 14: Frontend — QA + Tips pages + components

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/qa/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/tips/page.tsx`
- Modify: `frontend/components/qa/QAComponents.tsx`
- Modify: `frontend/components/qa/QARenderers.tsx`

- [ ] **Step 1: Update qa/page.tsx**

In `qa/page.tsx`, the API call currently sends `language: "pl"` hardcoded (~line 90). Update:

```typescript
import { getLocaleFromCookie } from '@/lib/locale';

// In the query call:
const res = await api.qa.query({
  ...
  language: getLocaleFromCookie(),
});
```

Add translations:
```tsx
const t = useTranslations('qa');
// t('title'), t('placeholder'), t('send'), t('sending')
// t('aboutWho'), t('aboutMe'), t('talent'), t('competency'), t('actions')
// t('history'), t('noHistory'), t('helpful'), t('notHelpful'), t('feedbackSent')
// t('errorGeneric')
```

- [ ] **Step 2: Update tips/page.tsx**

```tsx
const t = useTranslations('tips');
// t('title'), t('daily'), t('synergy')
// t('context.general'), t('context.feedback'), etc.
// t('generate'), t('generating'), t('helpful'), t('notHelpful')
// t('selectMember'), t('noTalents')
```

- [ ] **Step 3: Update QAComponents.tsx**

```tsx
const t = useTranslations('qa');
// Replace any hardcoded labels
```

- [ ] **Step 4: Update QARenderers.tsx**

```tsx
const t = useTranslations('qa');
// Replace action labels: t('talent'), t('competency'), t('actions')
```

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/qa/page.tsx" "frontend/app/(dashboard)/dashboard/tips/page.tsx" frontend/components/qa/
git commit -m "feat(frontend): QA and Tips pages use translations, send locale to backend"
```

---

## Task 15: Frontend — Organizations + Admin pages

**Files:**
- Modify: `frontend/app/(dashboard)/dashboard/organizations/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/organizations/[id]/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/settings/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/knowledge/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/users/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/knowledge/instructions/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/knowledge/faq/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/knowledge/merytoryka/page.tsx`

**Pattern** (same for all):
1. Add `import { useTranslations } from 'next-intl';`
2. Add appropriate `const t = useTranslations('...');`
3. Replace hardcoded Polish strings

- [ ] **Step 1: Update organizations/page.tsx**

```tsx
const t = useTranslations('organizations');
// t('title'), t('create'), t('name'), t('members'), t('teams'), t('view'), t('noOrgs')
```

- [ ] **Step 2: Update organizations/[id]/page.tsx**

```tsx
const t = useTranslations('organizations');
const tTeams = useTranslations('teams');
const tUsers = useTranslations('users');
// Replace relevant labels
```

- [ ] **Step 3: Update admin/settings/page.tsx**

```tsx
const t = useTranslations('admin.settings');
// t('title'), t('systemPrompt'), t('save'), t('saving')
```

- [ ] **Step 4: Update admin/knowledge/page.tsx**

```tsx
const t = useTranslations('admin.knowledge');
// t('title'), t('add'), t('category'), t('language'), t('content'), t('tags'), t('noItems')
```

- [ ] **Step 5: Update admin/users/page.tsx**

```tsx
const t = useTranslations('admin.users');
// t('title'), t('addUser'), t('noUsers')
```

- [ ] **Step 6: Update admin/knowledge sub-pages (instructions, faq, merytoryka)**

Each of these uses knowledge management. Apply `useTranslations('admin.knowledge')` for shared labels.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/(dashboard)/dashboard/organizations/" "frontend/app/(dashboard)/dashboard/admin/"
git commit -m "feat(frontend): organizations and admin pages use translations"
```

---

## Task 16: Frontend — TalentImport components + KnowledgeEntryManager

**Files:**
- Modify: `frontend/components/talent-import/TalentImportDialog.tsx`
- Modify: `frontend/components/talent-import/ManualTalentInput.tsx`
- Modify: `frontend/components/knowledge/KnowledgeEntryManager.tsx`

- [ ] **Step 1: Update TalentImportDialog.tsx**

```tsx
const t = useTranslations('talentImport');
// t('title'), t('pdfTab'), t('manualTab'), t('save'), t('saving')
// t('success'), t('error')
```

- [ ] **Step 2: Update ManualTalentInput.tsx**

```tsx
const t = useTranslations('talentImport');
// t('rank'), t('talent'), t('save'), t('saving')
```

For talent name display in the dropdown, use locale-aware names:
```typescript
import { getLocaleFromCookie } from '@/lib/locale';
const locale = getLocaleFromCookie();
// display: locale === 'en' ? talent.en : talent.pl
```

- [ ] **Step 3: Update PdfTalentImport.tsx**

```tsx
const t = useTranslations('talentImport');
// t('dropzone'), t('uploading'), t('processing'), t('success'), t('error')
```

- [ ] **Step 4: Update KnowledgeEntryManager.tsx**

```tsx
const t = useTranslations('admin.knowledge');
// t('add'), t('category'), t('language'), t('content'), t('tags')
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/talent-import/ frontend/components/knowledge/
git commit -m "feat(frontend): talent import and knowledge components use translations"
```

---

## Task 17: End-to-end verification

- [ ] **Step 1: Start the dev stack**

```bash
docker-compose up -d db
cd backend && uvicorn main:app --reload &
cd frontend && npm run dev
```

- [ ] **Step 2: Test PL → EN switch**

1. Open http://localhost:3000/login
2. Log in with a test user
3. Navigate to Settings
4. Click "English" in the language switcher
5. Verify: nav items change to English, page titles change, buttons change
6. Navigate to QA and ask a question
7. Verify: response comes in English

- [ ] **Step 3: Test EN → PL switch**

1. In Settings, click "Polski"
2. Verify: UI reverts to Polish
3. Ask a QA question
4. Verify: response in Polish

- [ ] **Step 4: Test persistence**

1. Set language to EN
2. Log out
3. Log in again
4. Verify: UI is in English (locale cookie set from user.language on login)

- [ ] **Step 5: Test unauthenticated pages**

1. Open /login without being logged in
2. Verify: page is in Polish (default locale)

- [ ] **Step 6: Commit any fixes found during verification**

```bash
git add .
git commit -m "fix(frontend): i18n verification fixes"
```

---

## Summary

| Task | Scope | Key files |
|---|---|---|
| 1 | Backend migration + schemas | models.py, schemas.py, migration |
| 2 | Backend AI endpoints | qa.py, tips.py, compare.py, dashboard.py |
| 3 | Fix gallup-data.ts PL names | gallup-data.ts |
| 4 | next-intl infrastructure | request.ts, next.config.ts, layout.tsx |
| 5 | Message files | pl.json, en.json |
| 6 | locale.ts + api.ts | locale.ts, api.ts |
| 7 | Auth pages + set locale on login | (auth)/* |
| 8 | Dashboard layout nav | (dashboard)/layout.tsx |
| 9 | Dashboard overview | dashboard/page.tsx |
| 10 | Settings + language switcher | settings/page.tsx |
| 11 | my-talents + talent components | my-talents/*, TalentBadge, UserManualCard |
| 12 | Teams + domain charts | teams/*, DomainChart, MatrixDashboard, TeamGrid |
| 13 | Users + Compare | users/*, compare/page.tsx |
| 14 | QA + Tips | qa/*, tips/*, QAComponents, QARenderers |
| 15 | Organizations + Admin | organizations/*, admin/* |
| 16 | Import + Knowledge components | talent-import/*, KnowledgeEntryManager |
| 17 | E2E verification | — |
