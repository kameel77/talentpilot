# TalentPilot — i18n: English Version Design

**Date:** 2026-05-29  
**Approach:** next-intl without URL prefix (cookie/context-based locale)  
**Scope:** Full PL ↔ EN language switcher — UI + AI-generated content

---

## Goal

Add a language switcher (Polish / English) to TalentPilot. Language preference is stored on the user's account (backend). Both the UI and AI-generated content respect the selected language.

---

## Backend

### 1. User model — new `language` field

Add `language VARCHAR(10) NOT NULL DEFAULT 'pl'` to the `users` table.

**New Alembic migration** (`k5f6g7h8i9j0_add_language_to_user.py`):
```python
op.add_column('users', sa.Column('language', sa.String(10), nullable=False, server_default='pl'))
```

Accepted values: `"pl"`, `"en"`. No enum constraint — keeps it flexible for future locales.

### 2. Schemas (`schemas.py`)

- `UserUpdate` — add `language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')`
- `UserResponse` — add `language: str = "pl"`
- `UserDetailResponse` — inherits from `UserResponse`, no extra change needed

### 3. AI endpoints — respect `current_user.language`

The following endpoints currently hardcode language or use `"pl"` as default. They must read `current_user.language` instead:

| Endpoint | File | Change |
|---|---|---|
| `POST /me/translate-profile` | `routers/users.py` | Already EN-aware, no change |
| `POST /qa` | `routers/qa.py` | Pass `language` to LLM prompt |
| `GET /compare` | `routers/compare.py` | Pass `language` to LLM prompt |
| `GET /tips` | `routers/tips.py` | Pass `language` to LLM prompt |
| `GET /api/dashboard/overview` | `routers/dashboard.py` | Pass `language` when fetching talent names |

**Pattern for AI prompts:** Prepend or append language instruction:
```python
lang_instruction = "Respond in English." if current_user.language == "en" else "Odpowiedz po polsku."
```

---

## Frontend

### 1. next-intl configuration (no URL routing)

next-intl v4.8.3 is already installed. Configure it in **message-based mode** without middleware.

**New files:**

```
frontend/
  messages/
    pl.json          ← all Polish UI strings
    en.json          ← all English UI strings
  i18n/
    request.ts       ← locale resolution (server-side)
```

**`frontend/i18n/request.ts`:**
```ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const locale = cookies().get('locale')?.value ?? 'pl';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**`frontend/next.config.ts`** — add next-intl plugin:
```ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
```

### 2. Layout — NextIntlClientProvider

**`frontend/app/layout.tsx`** wraps children with `NextIntlClientProvider`:
```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <PwaManager />
      </body>
    </html>
  );
}
```

### 3. Locale cookie — set on login / language change

A thin client-side helper sets the `locale` cookie and triggers a router refresh:

```ts
// lib/locale.ts
export function setLocale(lang: 'pl' | 'en') {
  document.cookie = `locale=${lang}; path=/; max-age=31536000`;
}
```

Called in two places:
- After successful login (reads `user.language` from `GET /api/users/me`)
- After language change in Settings (PATCH + setLocale + `router.refresh()`)

### 4. Message file structure

```json
// messages/pl.json
{
  "auth": {
    "login": {
      "title": "Zaloguj się",
      "emailLabel": "Email",
      "passwordLabel": "Hasło",
      "submit": "Zaloguj",
      "forgotPassword": "Nie pamiętam hasła"
    },
    "register": { ... },
    "forgotPassword": { ... },
    "resetPassword": { ... },
    "join": { ... }
  },
  "nav": {
    "dashboard": "Przegląd",
    "myTalents": "Moje talenty",
    "teams": "Zespoły",
    "users": "Użytkownicy",
    "compare": "Porównaj",
    "qa": "Q&A",
    "tips": "Wskazówki",
    "settings": "Ustawienia",
    "organizations": "Organizacje",
    "admin": "Admin"
  },
  "dashboard": { ... },
  "settings": {
    "language": {
      "title": "Język aplikacji",
      "pl": "Polski",
      "en": "English"
    },
    ...
  },
  "talents": { ... },
  "teams": { ... },
  "users": { ... },
  "compare": { ... },
  "qa": { ... },
  "tips": { ... },
  "common": {
    "save": "Zapisz",
    "cancel": "Anuluj",
    "delete": "Usuń",
    "add": "Dodaj",
    "edit": "Edytuj",
    "loading": "Ładowanie...",
    "error": "Wystąpił błąd"
  }
}
```

### 5. Component updates

Every page/component with hardcoded Polish strings:

```tsx
// Before
<h1>Moje talenty</h1>

// After
const t = useTranslations('talents');
<h1>{t('title')}</h1>
```

**Pages to update (26 total):**
- `(auth)/login`, `register`, `forgot-password`, `reset-password`, `join`
- `(dashboard)/dashboard/page.tsx` (overview)
- `(dashboard)/dashboard/settings/page.tsx`
- `(dashboard)/dashboard/my-talents/page.tsx`
- `(dashboard)/dashboard/teams/page.tsx` + `[id]/page.tsx`
- `(dashboard)/dashboard/users/page.tsx` + `[id]/page.tsx`
- `(dashboard)/dashboard/compare/page.tsx`
- `(dashboard)/dashboard/qa/page.tsx`
- `(dashboard)/dashboard/tips/page.tsx`
- `(dashboard)/dashboard/organizations/page.tsx` + `[id]/page.tsx`
- `(dashboard)/dashboard/admin/*` (4 pages)
- `(dashboard)/layout.tsx` (navigation)

**Components to update:**
- `DomainChart`, `MatrixDashboard`, `SettingsSection`, `TalentBadge`, `TeamGrid`, `UserManualCard`
- `KnowledgeEntryManager`, `QAComponents`, `QARenderers`
- `TalentImportDialog`, `ManualTalentInput`, `PdfTalentImport`

**Pages that stay as-is** (have their own i18n):
- `app/aboutme/[token]/page.tsx` — already has `T.pl/T.en` pattern
- `app/presentation/[token]/page.tsx` — already has its own system

### 6. Language switcher UI

Located in **`/dashboard/settings`** → "Profil" section, after existing fields:

```tsx
// Two-button toggle
<div className="flex gap-2">
  <Button variant={lang === 'pl' ? 'default' : 'outline'} onClick={() => handleLangChange('pl')}>
    Polski
  </Button>
  <Button variant={lang === 'en' ? 'default' : 'outline'} onClick={() => handleLangChange('en')}>
    English
  </Button>
</div>
```

`handleLangChange`:
1. `PATCH /api/users/{id}` with `{ language: newLang }`
2. `setLocale(newLang)` (sets cookie)
3. `router.refresh()` — next-intl re-reads the cookie, re-renders

---

## Data Flow

```
User clicks "English" in Settings
  → PATCH /api/users/{id} { language: "en" }       # persists to DB
  → setLocale("en")                                  # sets cookie
  → router.refresh()
  → layout.tsx re-runs → getLocale() reads "en"
  → NextIntlClientProvider loads messages/en.json
  → all useTranslations() return English strings
  → next API call to /qa or /tips sends request
    → backend reads current_user.language = "en"
    → AI prompt includes "Respond in English."
    → response returned in English
```

---

## Out of scope

- `aboutme` and `presentation` pages (already have their own bilingual system)
- Admin knowledge base content (stays in PL)
- Talent names from backend (already come with `name_en` field — frontend uses it based on locale)
- Email notifications (stays PL for now)

---

## Testing

- After switching to EN: all UI labels, buttons, nav items are in English
- After switching back to PL: all UI labels revert to Polish
- QA response comes in the language matching user preference
- Compare response comes in the language matching user preference
- Language preference persists after logout/login
- Unauthenticated pages (login, register) default to PL
