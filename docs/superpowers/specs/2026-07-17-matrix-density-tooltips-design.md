# Matrix Density, Full-Width Layout & Talent Tooltips with Admin CMS

**Date:** 2026-07-17
**Branch:** `feature/matrix-density-tooltips`
**Status:** Approved

## Problem

1. With the collapsed sidebar, dashboard pages waste horizontal space: `app/(dashboard)/layout.tsx` wraps every page in `max-w-7xl mx-auto` (1280 px) with `p-4 sm:p-6 lg:p-8` padding, leaving large empty margins on wide screens.
2. The team talent matrix (`components/dashboard/MatrixDashboard.tsx`) is ~1750 px wide (200 px name column + 34 talent columns at ~45 px), forcing horizontal scroll even on large desktops. The legacy app (team.talentpilot.io) fits the whole matrix on one screen.
3. Talent names in the matrix header carry no explanation. Users should see a talent description on hover, and admins should manage those descriptions in-app (CMS).

## Decisions (user-approved)

- **Full-width everywhere:** remove the global 1280 px cap; reading/form pages get local width limits.
- **Compact matrix cells permanently** (no density toggle).
- **Tooltip shows the short description** (`short_description`), not the full one.
- **Admin CMS edits names AND descriptions** per language (PL/EN).
- **PL short descriptions are pre-seeded** (written from official Gallup material); full PL descriptions stay empty for the admin to fill later.

## Design

### 1. Full-width layout

In `app/(dashboard)/layout.tsx` (main content wrapper, ~line 476):

- Remove the `max-w-7xl mx-auto w-full` inner wrapper.
- Reduce main padding: `p-4 sm:p-6 lg:p-8` → `p-4 sm:p-5 lg:p-6`.

Reading/form pages get a **local** centered width cap (`max-w-4xl` or `max-w-5xl`, judged per page during visual verification): Q&A (`dashboard/qa`), Tips (`dashboard/tips`), Settings (`dashboard/settings`), My Talents (`dashboard/my-talents`), Admin Settings (`dashboard/admin/settings`).

Table/matrix pages stay full width: dashboard home, teams, compare, users, admin/knowledge, admin/users, organizations.

Every dashboard page must be visually verified on the dev server after the change (collapsed and expanded sidebar).

### 2. Compact matrix (`MatrixDashboard.tsx`)

Target: total table width ≤ ~1350 px so it fits without horizontal scroll on 1440 px+ viewports with the collapsed sidebar. `overflow-x-auto` stays as fallback.

- Name column: `min-w-[200px]` → `min-w-[160px]`, padding `px-4 py-3` → `px-3 py-2`.
- Vertical headers: `minWidth: 40px` → `32px`, padding `px-2 py-4` → `px-1 py-3`, font size 11 px. Keep `writing-mode: vertical-rl` + rotate and the 4 px domain-colored top border.
- Cells: badge `w-8 h-8` → `w-7 h-7`, font `text-xs` → 11 px, td padding `px-1 py-2` → `px-0.5 py-1`.
- Apply the same cell treatment to the "Team ranking" and "In TOP 15" rows.

Out of scope: `PresentationContent.tsx` (presentation mode) is untouched.

### 3. Talent tooltip in the matrix header

- `MatrixDashboard` gets a new prop `talents: Talent[]` (the `api.talents.list()` payload the team page already fetches into `allTalents` — no extra requests). Prop is optional so other callers don't break.
- Hovering a talent header shows a tooltip: talent name + domain label (in domain color) + `short_description` in the user's locale.
- Fallbacks: missing locale description → EN description; missing both → name + domain only.
- Backend `GET /api/talents` already returns `translation.short_description`; verify the language resolution matches the user's locale (existing `_fetch_translation` logic in `backend/routers/talents.py`).
- Tooltip implementation: lightweight CSS/React hover tooltip consistent with existing UI patterns (check `components/ui` for an existing tooltip component before adding one). Must not clip inside `overflow-x-auto` — render with appropriate positioning (e.g. fixed/portal) if needed.

### 4. Admin CMS for talent content

**Backend** (`backend/routers/admin.py`, existing admin-guard pattern):

- `GET /api/admin/talents` — all 34 talents with **all** translations (both languages, name + short_description + description).
- `PATCH /api/admin/talents/{talent_id}/translations/{language}` — update `name`, `short_description`, `description` (all optional fields; partial update). Creates the translation row if it does not exist for that language.
- Schemas in `backend/schemas.py` following existing conventions.
- Tests (`backend/tests/`): non-admin gets 403, admin can list, admin can patch each field, patch on missing language creates the row.

**Frontend:**

- New page `app/(dashboard)/dashboard/admin/talents/page.tsx` following the `admin/knowledge` pattern: table of 34 talents grouped by domain; edit opens a modal with PL/EN tabs (name, short description, full description).
- API client methods in `lib/api.ts`.
- Sidebar link in the admin section of `app/(dashboard)/layout.tsx`.
- i18n entries in `messages/pl.json` and `messages/en.json`.

### 5. PL short descriptions

- Author Polish `short_description` for all 34 talents based on official Gallup descriptions (consistent with the official PL talent names from `seed_talents.py`).
- Add them to `backend/scripts/seed_talents.py` (fresh installs).
- New idempotent script `backend/scripts/backfill_talent_descriptions.py` that upserts the PL short descriptions into an existing database (the seed script skips when talents already exist). Safe to re-run; does not overwrite non-empty admin-edited values.

## Testing

- Backend: pytest for the new admin endpoints (auth guard + CRUD behavior).
- Frontend: visual verification of every dashboard page on the local dev stack (backend on port 8001), including the matrix at 1440 px and a narrower viewport (scroll fallback), tooltip hover, and the new admin page end-to-end (edit a description, see it in the tooltip).

## Out of scope

- Presentation mode matrix (`PresentationContent.tsx`).
- Density toggle (compact/comfort).
- Full PL `description` texts (admin fills via CMS when needed).
- Switching matrix talent names from `gallup-data.ts` to backend data (tracked separately; see i18n spec).
