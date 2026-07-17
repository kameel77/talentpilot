# Coach Dashboard Redesign — Design

Date: 2026-07-17
Status: approved for implementation (delegated; user directive: plan + implement via subagent)

## Context

- `/dashboard` (`frontend/app/(dashboard)/dashboard/page.tsx`) is a single page shared by
  all roles. For a COACH it shows team-oriented KPIs plus a "talent distribution" panel
  (`DomainProgress` bars + stacked bar) that carries no information in the coach context —
  aggregated over a whole organization the distribution is always near-identical, so it
  adds nothing to a coach's decisions.
- The desktop sidebar (`frontend/app/(dashboard)/layout.tsx`) is fixed at 256px with no
  way to collapse it. The matrix and analytics views (`/dashboard/teams/[id]` with
  `MatrixDashboard`) are the widest content in the app and benefit most from extra width.
- Coach model (see `docs/superpowers/specs/2026-07-03-coach-onboarding-design.md`):
  coach owns a private workspace org (`is_workspace=True`, never presented as a client),
  client orgs are granted via `OrganizationAccess`, individual clients live inside the
  workspace.

## Goals

1. A dedicated dashboard for the COACH role, visually and functionally distinct from the
   leader (admin/manager) and member (user) dashboard.
2. No "talent distribution" element on the coach dashboard.
3. Collapsible desktop sidebar (icon rail) to maximize horizontal space for the matrix
   and metrics — available to all roles.

## Non-goals

- No changes to the leader/member dashboard content (stays exactly as today).
- No embedding of `MatrixDashboard` on the coach dashboard — the matrix stays in the team
  view; the sidebar collapse is what buys it space.
- No changes to the Q&A engine or backend analytics algorithms.

## Approaches considered

- **A. Frontend-only:** compute coach stats from existing endpoints (org list + per-org
  user/talent fetches). Rejected — reintroduces the N+1 fetch pattern that
  `backend/routers/dashboard.py` was explicitly created to remove.
- **B. New backend aggregate endpoint + dedicated CoachDashboard component + global
  collapsible sidebar.** **Chosen** — one HTTP call, mirrors the existing
  `/api/dashboard/overview` pattern, clean role separation on the frontend.
- **C. Per-role configurable widget framework.** Rejected — overengineering for three
  roles (YAGNI).

## Design

### Backend — `GET /api/dashboard/coach-overview`

New endpoint in `backend/routers/dashboard.py`, response model in `schemas.py`
(dashboard section). COACH-only: any other role gets `403`.

```json
{
  "clients": [
    { "id": 3, "name": "Acme Sp. z o.o.", "members": 12, "teams": 3, "users_with_talents": 9 }
  ],
  "individual_clients": 4,
  "individual_clients_with_talents": 2,
  "totals": { "clients": 2, "teams": 5, "people": 24, "users_with_talents": 15 }
}
```

Rules:
- `clients` = organizations reachable via `OrganizationAccess` for the coach, **excluding**
  any org with `is_workspace=True` (the coach's own workspace must never appear as a
  client). Sorted by name.
- `individual_clients` = users in the coach's home (workspace) organization excluding the
  coach themself; `individual_clients_with_talents` analogous with at least one
  `UserTalent` row.
- `totals.people` = sum of client `members` + `individual_clients`;
  `totals.users_with_talents` analogous (clients + individuals).
- Implementation uses grouped aggregate queries (counts grouped by `organization_id`),
  not per-org loops.

Schemas (`schemas.py`): `CoachClientOverview`, `CoachDashboardTotals`,
`CoachDashboardOverview`.

### Frontend — role branch on `/dashboard`

`page.tsx` renders `<CoachDashboard />` when `tokenManager.getUser()?.role === "coach"`,
otherwise the existing content unchanged. The coach onboarding banner logic (currently in
`page.tsx`, coach-only) moves into `CoachDashboard`.

### Frontend — `components/dashboard/CoachDashboard.tsx`

Layout, top to bottom:

1. **Header** — title + greeting (reuse `dashboard.greeting`), primary CTA linking to
   `/dashboard/organizations` (label: "manage clients").
2. **Onboarding banner** — same logic as today (no clients and no individuals → banner
   linking to `/dashboard/onboarding`).
3. **KPI row** (4 × `KPICard`):
   - Clients (`totals.clients`; description shows `individual_clients` individual clients),
   - Teams (`totals.teams`),
   - People covered (`totals.people`),
   - Profile coverage (`totals.users_with_talents / totals.people` in %, "0%" when
     `people == 0`).
4. **Clients grid** ("Twoi klienci") — card per client org: name, members count, teams
   count, thin coverage bar (`users_with_talents / members`), action "open" which calls
   `tokenManager.setActiveOrgId(client.id)` and navigates to `/dashboard/teams` with a
   full page load (`window.location.assign`), consistent with the org switcher in the
   layout header. The grid ends with one extra card for individual clients (count +
   link to `/dashboard/organizations`). Empty state (no clients at all): dashed-border
   panel with CTA to `/dashboard/onboarding`.
5. **Q&A copilot tile** — reuse the existing tile markup from `page.tsx` (slimmer,
   full-width), linking to `/dashboard/qa`.

Explicitly absent: talent distribution (`DomainProgress`), member cards ("Your team"
section) — a coach works with clients, not a team of their own.

`lib/api.ts`: add `CoachClientOverview` / `CoachDashboardOverview` interfaces and
`api.dashboard.coachOverview()`.

### Frontend — collapsible sidebar (`layout.tsx`, all roles)

- New state `sidebarCollapsed` (desktop concept only; mobile slide-in behavior is
  untouched). Persisted in `localStorage` under `tp_sidebar_collapsed`; read after mount
  (in `useEffect`) to avoid SSR hydration mismatch; default expanded.
- Collapsed width **72px**, expanded 256px, CSS width transition (`transition-[width]`,
  ~300ms). Content in collapsed mode: logo mark only (no wordmark), nav icons centered
  with labels hidden, `title` attribute on links as tooltip, "Administration" section
  header hidden, admin knowledge sub-links hidden (the parent Knowledge link remains and
  navigates to the knowledge index page).
- Toggle button: desktop-only (`hidden lg:flex`) at the bottom of the sidebar, icons
  `PanelLeftClose` / `PanelLeftOpen` (lucide), aria-label from i18n.

### i18n (`messages/pl.json`, `messages/en.json`)

- `dashboard.coach.*` — title/subtitle, KPI labels and descriptions, clients section
  heading, card labels (members, teams, coverage, open), individual-clients card,
  empty-state copy, manage-clients CTA.
- `nav.collapseMenu`, `nav.expandMenu`.

## Error handling

- `coach-overview` failure on the frontend → same error panel pattern as the current
  dashboard (`dashboard.loadError`).
- Backend endpoint returns 403 (not 404) for non-coach roles; no data leakage in detail.

## Testing

- **pytest** (`backend/tests/`): new tests for `coach-overview` —
  1. coach with 2 client orgs + workspace individuals → correct per-client counts,
     individual counts, totals;
  2. workspace org never present in `clients`;
  3. admin / manager / user → 403;
  4. coach with no clients and no individuals → zeros and empty list.
- **Frontend:** `npm run build` (type check) plus manual verification on the local dev
  stack (backend on port 8001) with a coach account: coach sees the new dashboard without
  talent distribution; admin/manager/user dashboards unchanged; sidebar collapses,
  persists across reload, mobile behavior unchanged.
