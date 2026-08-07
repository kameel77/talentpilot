# Layout & Space-Usage Audit — Dashboard App

Scope: every page under `frontend/app/(dashboard)/`, the shared shell `frontend/app/(dashboard)/layout.tsx`, and `frontend/app/aboutme/[token]/page.tsx`. Read-only, static analysis (no live rendering / no browser used) — all claims are backed by exact `file:line` evidence from the source. Where something can't be verified without rendering, that's stated explicitly.

Auth pages (register/login split-screen shell) are out of scope per instructions — known issue being fixed separately.

---

## Summary — top 3 problems

1. **The same "profile" layout is capped at two different widths for no functional reason.** `dashboard/users/[id]/page.tsx` (viewing someone else) is `max-w-5xl`, while `dashboard/my-talents/page.tsx` (viewing yourself) — near-identical card layout — is `w-full`. Multiply this by 9 different container-width values used across 20 pages (`max-w-4xl` → unconstrained) with no documented convention, and the app reads as visually inconsistent screen-to-screen even though most individual screens are fine on their own.
2. **"List of people" is reimplemented from scratch at least 6 times** (dashboard member cards, users grid cards, teams-detail table rows, compare/tips user-picker dropdowns, IndividualClientsTab rows, QA team-member cards) — each with its own avatar size/shape/color, card radius, and action-button treatment. This is the biggest consolidation opportunity and the main source of "does every page use the same pattern?" — no, it doesn't.
3. **Loading and empty states are inconsistent to the point of being a UX regression on two pages.** `dashboard/teams/[id]/page.tsx` and `dashboard/users/[id]/page.tsx` — arguably the two most important detail pages — show a bare `"Ładowanie..."` text string with no spinner, while every list page around them uses either a `Loader2` icon or a hand-rolled CSS spinner. `dashboard/my-talents/page.tsx` has no loading state at all.

None of this needs a redesign — it's a targeted consolidation/cleanup job. See the prioritized list at the bottom.

---

## Page × Dimension Table

| Page | Container width | Top-level spacing | Header pattern | Loading state | Empty state style |
|---|---|---|---|---|---|
| `dashboard/page.tsx` (TeamDashboard) | `w-full` (L104) | `space-y-8` | A (hero, mt-1) | `Loader2` (L71) | dashed-3xl p12/p16 (L157, L227) |
| `components/dashboard/CoachDashboard.tsx` (same route, coach role) | `max-w-7xl mx-auto` (L81) | `space-y-8` | A | `Loader2` (L49) | dashed-3xl p12/p16 (L149) |
| `dashboard/users/page.tsx` | unconstrained (L251) | `space-y-10` | C (hero, mt-2, `max-w-2xl` subtitle) | custom CSS spinner (L243) | dashed-3xl p16 (L527) |
| `dashboard/users/[id]/page.tsx` | `max-w-5xl mx-auto` (L540) | `space-y-6` | B (`text-headline`/`text-body`) | **plain text, no spinner** (L432) | Card, centered icon (L617) |
| `dashboard/teams/page.tsx` | unconstrained (L136) | `space-y-10` | C | custom CSS spinner (L128) | dashed-3xl p16 (L159) |
| `dashboard/teams/[id]/page.tsx` | unconstrained (L356) | `space-y-6` | unique, card-embedded (L357-402) | **plain text, no spinner** (L343) | icon-circle box, different radius (L541) |
| `dashboard/compare/page.tsx` | `w-full` (L211) | `space-y-8` | A | `Loader2` (L203, 265) | dashed-3xl p12 (L472) |
| `dashboard/my-talents/page.tsx` | `w-full` (L405) | `space-y-6` | B | **none at all** (no `loading` state var) | Card, centered icon (L155) |
| `dashboard/onboarding/page.tsx` | own `min-h-screen` wrapper (L78) — fights layout shell | n/a | unique, centered wizard | n/a | n/a |
| `dashboard/organizations/page.tsx` | unconstrained (L125) | `space-y-10` | C | custom CSS spinner (L117) | dashed-3xl p16 (L181) |
| `dashboard/organizations/[id]/page.tsx` | `max-w-5xl mx-auto` (L177) | `space-y-8` | unique, back-link+icon (L180-217) | custom CSS spinner (L155) | dashed-2xl p12 (smaller variant) (L308) |
| `dashboard/qa/page.tsx` | `w-full` (L185) | `space-y-8` | A (inside `<header>`) | inline `Loader2` only, no page-level state (L281) | custom centered placeholder, not dashed-box (L232) |
| `dashboard/settings/page.tsx` | `w-full overflow-hidden` (L486) | `space-y-6` | B | **none** (renders empty fields, fills after fetch) | n/a |
| `dashboard/tips/page.tsx` | `w-full` (L291) | `space-y-8` | A | `Loader2` (contextual) (L334, 449) | dashed-3xl p10 (smaller variant) (L367, 564) |
| `dashboard/admin/settings/page.tsx` | `max-w-4xl mx-auto` (L67) | `space-y-8` | A | `Loader2` (L60) | n/a |
| `dashboard/admin/users/page.tsx` | `max-w-6xl mx-auto` (L274) | `space-y-8` | A + inline icon variant (L277) | `Loader2` (L267) | none (table just renders empty) |
| `dashboard/admin/talents/page.tsx` | unconstrained (L140) | `space-y-8` | A | `Loader2` (L133) | none |
| `dashboard/admin/knowledge/page.tsx` (hub) | `max-w-5xl mx-auto` (L106) | `space-y-8` | A | `Loader2` (implicit, L97) | Card `border-dashed-2` (L216) |
| `dashboard/admin/knowledge/{faq,merytoryka,instructions}/page.tsx` → `KnowledgeEntryManager` | **unconstrained** (L432) — inconsistent with the hub it lives under | `space-y-6` | unique, inline count badge, missing `font-heading` (L436) | **plain text in Card**, no spinner (L533) | Card `border-dashed-2`, plain text, no icon (L536) |
| `aboutme/[token]/page.tsx` (outside dashboard layout) | own shell, `max-w-4xl mx-auto` (L183, 220) | n/a | unique public-page header | `Loader2`, full-screen (L138) | custom 404 w/ emoji (L145) |

---

## 1. Container width & wasted space

**Values in use, no documented convention:** `max-w-4xl` (896px), `max-w-5xl` (1024px), `max-w-6xl` (1152px), `max-w-7xl` (1280px), and unconstrained (`w-full`/no class) — 9 pages use one of these, 11 use none. On a 1920px display, after the ~256px sidebar (`dashboard/layout.tsx:341`) and `main` padding (`p-4 sm:p-5 lg:p-6`, `layout.tsx:484`), the usable content well is roughly 1550-1600px wide.

- **`dashboard/users/[id]/page.tsx:540`** (`max-w-5xl mx-auto`, 1024px) vs **`dashboard/my-talents/page.tsx:405`** (`w-full`) — these two pages render essentially the same component shape (Trophy "Top Talents" card, domain-summary card, quick-tips card, "share profile" card, `lg:grid-cols-3`, see `users/[id]/page.tsx:642` vs `my-talents/page.tsx:432`) but one is squeezed to 1024px and the other spans the full ~1600px well. This is the single cleanest, lowest-risk fix in the whole audit — same JSX shape, different container class.
- **`dashboard/organizations/[id]/page.tsx:177`** (`max-w-5xl mx-auto`) vs **`dashboard/teams/[id]/page.tsx:356`** (unconstrained) — both are "detail page for one entity with a data table/grid below," but org-detail wastes ~35% of the content well while team-detail (which has an actual wide talent matrix) correctly goes full width.
- **`dashboard/admin/settings/page.tsx:67`** (`max-w-4xl`, 896px) is the narrowest cap in the app for a page whose main content is `Textarea` fields (`min-h-[250px]`, `min-h-[180px]`, `admin/settings/page.tsx:169,217`) — a defensible readability choice for long-form prompt text, but it's the only page in the audit deliberately optimizing for line length; every other page just accepts whatever width its grid produces.
- **`dashboard/admin/knowledge/page.tsx:106`** (hub, `max-w-5xl`) vs its own subpages **`components/knowledge/KnowledgeEntryManager.tsx:432`** (`faq`/`merytoryka`/`instructions`, unconstrained) — navigating from the hub card ("Przejdź do FAQ") to the actual FAQ page changes the content width. This is a parent→child inconsistency inside a single feature, not just an app-wide style drift.
- **Same route, two widths depending on role:** `/dashboard` renders `TeamDashboard` (`dashboard/page.tsx:104`, `w-full`) for members/managers or `CoachDashboard` (`components/dashboard/CoachDashboard.tsx:81`, `max-w-7xl mx-auto`) for coaches. A coach and a manager looking at "their dashboard" on the same monitor see different amounts of whitespace on the sides purely because of role, not content shape (both use the same `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` KPI row, compare `dashboard/page.tsx:123` and `CoachDashboard.tsx:112`).
- **List pages are unconstrained while their detail pages are capped** — `users` (unconstrained) → `users/[id]` (`max-w-5xl`); `organizations` (unconstrained) → `organizations/[id]` (`max-w-5xl`). Only `teams` → `teams/[id]` keeps both unconstrained. No stated reason why teams is the exception.
- **Long prose vs. full width:** the only real "line length hurts readability" candidates are `admin/settings` (already capped, see above) and the free-text sections in `users/[id]`/`my-talents`/`settings` (superpowers/motivators/blockers `<textarea>`/`<p>` blocks) — these sit inside `lg:col-span-2` of a 3-column grid, so effective text width is already naturally constrained by the grid, not by a page-level `max-w`. No action needed there.

**Where a data-dense page is correctly unconstrained (no problem, noted for completeness):** `teams/[id]` talent matrix (`MatrixDashboard.tsx`, table wrapped in `overflow-x-auto`, `MatrixDashboard.tsx:202`) and `admin/users` table (`max-w-6xl`, borderline — 1152px for a 4-column table with generous `px-6 py-4` cells, `admin/users/page.tsx:274,306` — not egregious but could go unconstrained like `teams/[id]` without hurting anything).

---

## 2. Page shell consistency

### Header patterns — at least 4 distinct implementations coexist

- **Pattern A** — "hero" header, `text-3xl font-bold font-heading text-slate-900 tracking-tight` + `<p className="mt-1 text-slate-500 font-medium">`: `dashboard/page.tsx:108-111`, `CoachDashboard.tsx:85-90`, `compare/page.tsx:214-217`, `qa/page.tsx:188-191`, `tips/page.tsx:294-297`, `admin/settings/page.tsx:69-72`, `admin/talents/page.tsx:143-144`, `admin/knowledge/page.tsx:109-112`.
- **Pattern C** — same hero style but `mt-2` + `max-w-2xl` on the subtitle instead of `mt-1`/`font-medium`: `users/page.tsx:254-257`, `teams/page.tsx:139-142`, `organizations/page.tsx:128-131`. A near-duplicate of Pattern A with two class differences repeated three times — looks like drift, not intent.
- **Pattern B** — semantic utility classes `text-headline` / `text-body` (defined once, used sparingly): `users/[id]/page.tsx:554,559`, `my-talents/page.tsx:418-419`, `settings/page.tsx:489-490`. These three pages render visibly different typography from every Pattern-A/C page (worth checking what `text-headline`/`text-body` resolve to in the design tokens — not verified here since it requires reading the CSS/Tailwind config, out of static-JSX scope).
- **Ad-hoc, page-specific headers** (no shared pattern at all): `teams/[id]/page.tsx:357-402` (title is a dropdown button inside a bordered card, no subtitle, action buttons on the same row); `organizations/[id]/page.tsx:180-217` (back-link + icon avatar + title, no subtitle); `KnowledgeEntryManager.tsx:434-442` (title + inline count badge in a `space-y-2` header, description styled like Pattern C but missing `font-heading`); `onboarding/page.tsx:80-89` (centered wizard title, no relation to any other header).

### Vertical rhythm — three different scales, roughly (but not cleanly) tied to page type

- `space-y-10`: top-level list/index pages — `users/page.tsx:251`, `teams/page.tsx:136`, `organizations/page.tsx:125`.
- `space-y-8`: dashboards and most "form/settings-like" pages — `dashboard/page.tsx:104`, `CoachDashboard.tsx:81`, `compare/page.tsx:211`, `qa/page.tsx:185`, `tips/page.tsx:291`, `admin/settings/page.tsx:67`, `admin/talents/page.tsx:140`, `admin/knowledge/page.tsx:106`, `organizations/[id]/page.tsx:177`.
- `space-y-6`: detail/profile pages — `users/[id]/page.tsx:540`, `teams/[id]/page.tsx:356`, `my-talents/page.tsx:405`, `settings/page.tsx:486`, `KnowledgeEntryManager.tsx:432`.

The `space-y-8` bucket is the odd one out — it mixes genuine dashboards (KPI-grid pages) with a plain settings-style form page (`admin/settings`) and a detail page (`organizations/[id]`, which by the "detail pages get space-y-6" rule implied by `users/[id]`/`teams/[id]` should be `space-y-6`, not `space-y-8`). This isn't a documented system — it's an emergent, partially-consistent habit. Worth writing down once fixed.

### Pages fighting the dashboard shell

- **`dashboard/onboarding/page.tsx:78`** — `MemberOnboarding` renders `<div className="flex min-h-screen items-center justify-center px-6 py-12 bg-slate-50">`. This lives inside `layout.tsx`'s `<main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6 bg-slate-50">` (`layout.tsx:484`), which already scrolls and already sets the same `bg-slate-50`. The nested `min-h-screen` measures against the full viewport even though `main` has already lost 64px to the header (`layout.tsx:352`, `height: '64px'`) and has its own padding — in practice this means the onboarding content is taller than necessary and can produce an extra, avoidable scrollbar inside `main`, plus the redundant `bg-slate-50` and `px-6 py-12` double up on `main`'s own `p-4 sm:p-5 lg:p-6`. This is the one page in scope that reimplements the shell instead of using it. (Confirmed by reading the JSX nesting; actual visual overflow would need a browser to measure exactly, but the structural conflict — `min-h-screen` inside an already-viewport-height flex column — is unambiguous from the code.)

---

## 3. Responsive behaviour

- **`MatrixDashboard.tsx`** (talent matrix, used by `teams/[id]`): wrapped in `overflow-x-auto` (`L202`) so it doesn't break layout, but there's no alternate mobile rendering — 34 talent columns at `minWidth: '32px'` each (`L217`) with `w-6 h-6` (24px) rank cells (`L256`) means the only "mobile treatment" is horizontal scrolling a table that's roughly 1100px+ wide regardless of viewport. Usable on a laptop, effectively unusable on a phone (tiny scroll target, tiny text). No fallback card/accordion view exists in scope.
- **`dashboard/qa/page.tsx:217`** — `<section className="grid gap-6 xl:grid-cols-[2fr_1fr]">` jumps straight from 1 column to 2 columns at the `xl` breakpoint (1280px). Common laptop widths (1024-1279px) get the single-column layout even though there's room for two — this under-uses space on exactly the kind of screen the "make good use of screen real estate" concern is about. Compare to `settings/page.tsx` which uses `lg:` (1024px) for its equivalent multi-column rows (e.g. `L494`, `L717`, `L965`).
- **`dashboard/admin/users/page.tsx:325-326`** — the user table renders `{user.email}` directly with no `isPlaceholderEmail()` guard and no `truncate` class:
  ```
  <div className="font-semibold text-slate-900">{user.full_name}</div>
  <div className="text-slate-500 text-xs">{user.email}</div>
  ```
  Every other page that displays a possibly-ghost user's email guards it — `users/[id]/page.tsx:559` (`isPlaceholderEmail(user.email) ? "—" : user.email`), `teams/[id]/page.tsx:580`, `aboutme/[token]/page.tsx:254`. Admin's user list is the one place a long generated placeholder email can appear unguarded and unwrapped, which is a real overflow/ugly-cell risk in a table cell that has no `overflow-hidden`/`truncate` safety net either.
- **Tables generally handle overflow correctly**: `teams/[id]/page.tsx:551` and `admin/users/page.tsx:306` both wrap their `<table>` in `overflow-x-auto`, so no layout-breaking horizontal overflow risk was found in the audited table markup.
- **KPICard** (`components/ui/KPICard.tsx:18`, `p-8` fixed padding, no responsive reduction) is reused correctly across `dashboard/page.tsx`, `CoachDashboard.tsx`, and `users/page.tsx` inside `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` grids — on mobile the card is full-width so `p-8` isn't broken, just heavier than it needs to be; minor, not a functional bug.
- **`settings/page.tsx`** relies on bare `lg:grid-cols-5` (no base `grid-cols-*`, e.g. `L494`) — this is actually fine: Tailwind's implicit single-column default means it stacks correctly below `lg`, no missing breakpoint bug there, despite looking underspecified at first glance.

---

## 4. Density & repeated patterns

### "List of a person / list of people" — at least 6 independent implementations, zero shared component

| Implementation | Location | Avatar | Container |
|---|---|---|---|
| Dashboard member grid | `dashboard/page.tsx:277-306` (`MemberCard`) | `h-14 w-14 rounded-full bg-indigo-600`, initials | `rounded-3xl` card, hover lift |
| Users list grid | `dashboard/users/page.tsx:546-641` | `h-12 w-12 rounded-xl bg-slate-100`, initials, different bg entirely | `rounded-2xl` card, hover lift |
| Team members table | `dashboard/teams/[id]/page.tsx:562-585` | `h-10 w-10 rounded-full` gradient `from-blue-500 to-indigo-600`, initials | `<tr>` row, not a card |
| Individual clients list | `components/clients/IndividualClientsTab.tsx:147-160` | `h-10 w-10 rounded-full bg-slate-100` + generic `UserRound` **icon**, not initials | `rounded-xl` link row |
| Compare user-picker dropdown | `dashboard/compare/page.tsx:115-132` (`UserSelector`) | `h-8`/`h-10 w-8`/`w-10 rounded-full bg-indigo-600`, initials | dropdown list item |
| Tips synergy-picker dropdown | `dashboard/tips/page.tsx:427-441` | same shape as compare's, but `bg-emerald-600` instead of `bg-indigo-600` — a near-literal duplicate of `UserSelector` re-implemented with a different color, not shared | dropdown list item |
| QA team-member card | `dashboard/qa/page.tsx:12,354-361` (`TeamMemberCard` from `components/qa/QAComponents`) | not inspected in this pass (separate component file, out of the read list) but confirmed as yet another distinct call site with its own props shape | card |

Seven call sites, at least five different avatar treatments (size ranges from `h-8` to `h-14`; shape alternates `rounded-full`/`rounded-xl`; fill alternates flat `bg-indigo-600`/gradient/`bg-slate-100`+icon), three different container types (card / table row / dropdown item / link row). This is the strongest, lowest-ambiguity consolidation target in the codebase — a single `PersonAvatar` + `PersonRow`/`PersonCard` pair (with a `dense`/`card`/`dropdown` variant prop) would cover all seven.

**Positive counter-example, for contrast:** `KPICard` (`components/ui/KPICard.tsx`) *is* shared correctly and reused as-is across `dashboard/page.tsx`, `CoachDashboard.tsx`, and `users/page.tsx` — proof the team already knows how to do this; it just wasn't applied to the "person" pattern.

### Empty states

A good baseline convention exists — `rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 sm:p-16 text-center` + icon + title + description (+ optional CTA) — used consistently on the top-level list pages: `dashboard/page.tsx:227-241`, `users/page.tsx:526-542`, `teams/page.tsx:158-173`, `organizations/page.tsx:180-193`, `compare/page.tsx:471-481`, `CoachDashboard.tsx:148-160`. Good, keep it.

It breaks down one level deeper / on secondary pages:

- `teams/[id]/page.tsx:540-549` — members-empty panel uses a plain `bg-slate-100 rounded-full` icon circle, not the dashed-border convention.
- `organizations/[id]/page.tsx:307-320` — teams-empty panel uses `rounded-2xl` + `p-12` (smaller radius and padding than the `rounded-3xl p-16` convention).
- `components/clients/IndividualClientsTab.tsx:128` — just `<p className="text-slate-500 text-sm py-8 text-center">{t("empty")}</p>`, no icon, no card, no CTA at all.
- `dashboard/admin/knowledge/page.tsx:216-228` and `components/knowledge/KnowledgeEntryManager.tsx:536-542` — both use a `Card` with `border-dashed border-2`, which is a *different* Tailwind pattern (`border-2` vs the convention's default `border`) than the top-level pages, and `KnowledgeEntryManager`'s version drops the icon entirely.

### Loading states

Three distinct implementations in play, and they don't correlate with page importance:

1. **`Loader2` icon** (lucide, `animate-spin`) — the majority pattern: `dashboard/page.tsx:71`, `CoachDashboard.tsx:49`, `compare/page.tsx:203,265`, `tips/page.tsx:334,449`, `admin/settings/page.tsx:60`, `admin/users/page.tsx:267`, `admin/talents/page.tsx:133`.
2. **Hand-rolled CSS spinner** (`<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />`) — a second, functionally-identical but visually-different spinner: `users/page.tsx:243`, `teams/page.tsx:128`, `organizations/page.tsx:117`, `organizations/[id]/page.tsx:155`.
3. **Plain text, no spinner at all** — `teams/[id]/page.tsx:343` (`<div className="text-gray-600">{tCommon('loading')}</div>`) and `users/[id]/page.tsx:432` (identical pattern). These are, ironically, two of the heavier/slower-loading detail pages (each fires 2-4 parallel API calls on mount), and they have the weakest loading feedback in the app.
4. **No loading state at all** — `my-talents/page.tsx` has no `loading` boolean; the page can render `EmptyTalentsView` (`my-talents/page.tsx:429-430`) for a moment before the async fetch (`my-talents/page.tsx:278-305`) resolves, i.e. a possible flash-of-empty-state. `settings/page.tsx` similarly has no loading gate — form fields just populate after the fetch resolves (`settings/page.tsx:142-192`).

No skeleton loaders exist anywhere in the audited scope — every loading state is either a spinner or nothing.

---

## 5. Prioritized recommendations

### Quick wins (single file, low risk)

| # | Fix | File(s) | Effort |
|---|---|---|---|
| 1 | Change `users/[id]` container from `max-w-5xl mx-auto` to `w-full` to match `my-talents` (same layout shape) | `dashboard/users/[id]/page.tsx:540` | ~5 min |
| 2 | Remove or widen the `max-w-5xl` cap on org detail to match `teams/[id]` (unconstrained) | `dashboard/organizations/[id]/page.tsx:177` | ~5 min |
| 3 | Align `KnowledgeEntryManager`'s container with its hub page (`max-w-5xl mx-auto`) so navigating in/out doesn't change page width | `components/knowledge/KnowledgeEntryManager.tsx:432` | ~10 min |
| 4 | Remove the redundant `min-h-screen`/`bg-slate-50`/`px-6 py-12` wrapper in onboarding; let it sit inside the existing `main` padding | `dashboard/onboarding/page.tsx:78` | ~15 min (recheck vertical centering) |
| 5 | Replace the two bare-text loading states with the standard `Loader2` block used elsewhere | `dashboard/teams/[id]/page.tsx:343`, `dashboard/users/[id]/page.tsx:432` | ~10 min |
| 6 | Collapse the hand-rolled CSS spinner into the `Loader2` pattern (visual/behavioral no-op, just consistency) | `dashboard/users/page.tsx:243`, `dashboard/teams/page.tsx:128`, `dashboard/organizations/page.tsx:117`, `dashboard/organizations/[id]/page.tsx:155` | ~20 min |
| 7 | Guard the admin users table email cell with `isPlaceholderEmail()` + `truncate`, matching every other page that shows user emails | `dashboard/admin/users/page.tsx:325-326` | ~5 min |
| 8 | Give `IndividualClientsTab`'s empty state the same dashed-box treatment as sibling list pages | `components/clients/IndividualClientsTab.tsx:128` | ~10 min |
| 9 | Change the QA two-column section from `xl:grid-cols-[2fr_1fr]` to `lg:grid-cols-[2fr_1fr]` so laptop widths get the split layout | `dashboard/qa/page.tsx:217` | ~5 min (spot-check the chat column isn't cramped at 1024px) |
| 10 | Add a `loading` gate to `my-talents` to prevent a possible flash of the empty state before data arrives | `dashboard/my-talents/page.tsx:278-305,429-430` | ~15 min |

### Structural (shared component / convention change)

| # | Fix | Files touched | Effort |
|---|---|---|---|
| 1 | Extract one `PersonAvatar` + `PersonRow`/`PersonCard` component (variant prop for card/table-row/dropdown) and migrate the 6-7 existing implementations onto it | `dashboard/page.tsx`, `dashboard/users/page.tsx`, `dashboard/teams/[id]/page.tsx`, `dashboard/compare/page.tsx`, `dashboard/tips/page.tsx`, `components/clients/IndividualClientsTab.tsx`, `components/qa/QAComponents.tsx` | 1-2 days |
| 2 | Build a shared `PageHeader` (title + subtitle + optional action button) and migrate the 4 header patterns onto it | ~15 pages listed in the table above | 0.5-1 day |
| 3 | Decide and document one vertical-rhythm convention (e.g. `space-y-6` detail pages / `space-y-8` dashboards, drop the third `space-y-10` bucket) | all pages in the table | 0.5 day (mostly a product/design decision, mechanical to apply) |
| 4 | Decide one max-width convention for the content well (either "always full width, let padding do the work" or "cap detail/settings pages at one token, leave data-dense pages unconstrained") and apply it everywhere instead of the current 9-value spread | all pages with a `max-w-*`/unconstrained container listed in the table | 0.5 day decision + 0.5 day implementation |
| 5 | Build one shared `EmptyState` component (icon + title + description + optional CTA) and replace the ~6 hand-rolled variants | `dashboard/teams/[id]/page.tsx`, `dashboard/organizations/[id]/page.tsx`, `components/clients/IndividualClientsTab.tsx`, `dashboard/admin/knowledge/page.tsx`, `components/knowledge/KnowledgeEntryManager.tsx` | 0.5 day |
| 6 | Build one shared `LoadingState` component and replace the 3 divergent full-page implementations (this folds in quick wins #5/#6 above as the "before" state) | list above | 0.5 day |
| 7 | (Lower priority / nice-to-have) Give the talent matrix a real mobile rendering path instead of relying on horizontal scroll of a 34-column table | `components/dashboard/MatrixDashboard.tsx` | 2-3 days — only worth it if mobile usage by coaches/managers is material; not urgent |

**Suggested order:** do the 10 quick wins first (all are same-day, low-risk, each touches 1-4 files) — they alone fix the two most visible inconsistencies (users/[id] vs my-talents width, and the two silent-loading detail pages). Then tackle structural #2 (PageHeader) and #4 (width convention) together since they're both "pick a convention, apply everywhere" work; #1 (PersonAvatar/PersonRow) is the highest-value structural item but also the largest, so schedule it once the header/width convention is settled so the new person component can follow the same convention from day one.
