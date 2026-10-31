# Implementation Brief #4 — Coach client flow: "Add client" everywhere, guided first steps

**Status:** P1 implemented (2026-10-31, see DEVLOG), P2–P4 ready for implementation
**Owner:** implementing agent
**Reviewer:** Kamil
**Date:** 2026-10-31
**Builds on:** `BRIEF_COACH_SIGNUP_ONBOARDING.md` (#1), `BRIEF_ACCOUNT_MODEL_AND_SHARE_LINKS.md` (#2)

---

## 0. How "done" is defined

Same rule as brief #2: a requirement is done when its **proof** exists and passes. A green build is necessary, never sufficient.

---

## 1. Problem (facts from code, 2026-10-31)

The first minutes of the coach journey work: role choice, PDF-first wizard, bulk PDF, share link. The journey breaks **after the first client**.

| # | Finding | Where |
|---|---|---|
| F1 | **An individual client cannot be added outside the wizard.** The "Individuals" tab has no add action; the header button always says "Add organization". The empty state points to the wizard, but the wizard redirects to the dashboard as soon as any client exists. `/dashboard/users` is not in the coach nav (and is English-only, team-required). | `organizations/page.tsx`, `IndividualClientsTab.tsx`, `CoachWizard.tsx` resume effect, `layout.tsx` nav filter |
| F2 | **The wizard is one-shot.** The second company client takes 4 screens in 3 contexts: list → 5-field B2B modal (NIP, street, postal code) → org card → team modal → team page → PDF import. | `organizations/page.tsx`, `organizations/[id]/page.tsx` |
| F3 | **Two "open client" targets and a hidden global context.** Dashboard card switches the global active org and reloads into `/dashboard/teams`; the clients list opens `/organizations/[id]`. Teams/Compare/Tips/QA depend on the header org switcher. | `CoachDashboard.tsx`, `layout.tsx` (`handleOrgChange` → `window.location.reload()`) |
| F4 | **No guidance after onboarding.** The wizard ends on a profile/matrix; nothing points to the next value moments (share link, presentation mode, compare, AI). | — |
| F5 | Wizard polish: no Back; step counter changes its total mid-flow and labels steps with field names; the "drop zone" does not accept drops; PDF parsing hardcodes `pl`; bulk submit checks the plan limit for 1 instead of N; bulk import is implemented twice (wizard + team page); hardcoded strings ("Brak NIP", "Link", "np. Anna Kowalska"). | `CoachWizard.tsx`, `teams/[id]/page.tsx`, `organizations/page.tsx` |
| F6 | Zero analytics events in the frontend. Funnel drop-off is unmeasurable. | — |

**Diagnosis:** the main friction is not the number of fields — it is that the *add client* entry point disappears exactly where the coach looks for it, and a client has no single "home".

**Confidence:** derived from reading code, not from usage data (there is none — see P4). Cheapest validation: ask 2–3 design-partner coaches to screen-record adding their *second* client.

---

## 2. Scope

| # | Change | Impact | Effort |
|---|---|---|---|
| **P1** | One reusable **Add client** flow (person / company), available from the dashboard, both client tabs and all empty states. The onboarding wizard becomes a thin wrapper around the same flow. | Unblocks 1:1 coaching (F1), makes client #2 as easy as client #1 (F2), fixes F5 inside the flow | 2–3 d |
| **P2** | **"First steps" checklist** on the coach dashboard, auto-completed from data, plus a "What next?" block on the flow's done screen. | Hand-holding beyond the first client (F4) | 1–2 d |
| **P3** | Remaining polish: coach-only "name only" company creation everywhere, migrate the team page bulk import to the shared component, i18n leftovers. | Consistency, one implementation of bulk import | 0.5–1 d |
| **P4** | Funnel analytics: 6 events. | Measure instead of guess (F6) | 0.5 d |
| P5 *(next iteration, not in this brief)* | **Client folder**: `/organizations/[id]` as the single home of a company client, active org set implicitly, client name visible in the header. | Fixes F3 | 3–5 d, higher regression risk |

Non-goals: backend changes (none required for P1–P3), billing changes, session notes (see `COACH_PRODUCT_DIRECTIONS.md`).

---

## 3. P1 — "Add client" flow

### Target UX

```
[Dodaj klienta]  (dashboard header, clients page header, empty states)
      │
      ▼
 Step 1  Kogo chcesz dodać?   ── Osoba prywatna ──►  Step 2  Osoba: PDF → imię (auto) → e-mail (opcj.)  ──► Gotowe: link do profilu
                              └─ Firma ───────────►  Step 2  Nazwa firmy + pierwszy zespół (domyślnie "Zespół główny")
                                                     Step 3  Osoby: przeciągnij N PDF-ów → przegląd → "Dodaj wszystkich"
                                                             (lub pojedynczo / "Dodam osoby później")
                                                     Gotowe: matryca zespołu, linki do profili
      Done screen: [Otwórz profil | Otwórz matrycę]  [Dodaj kolejnego klienta]  [Zamknij]
```

Rules:

1. **One component, two shells.** `components/clients/add-client/AddClientFlow.tsx` holds the step machine. Shells: `AddClientDialog.tsx` (dashboard, clients page) and `CoachWizard.tsx` (onboarding page, with welcome header and Skip).
2. **Stable stepper.** Step 1 is always "Client type". Person path = 3 steps, company path = 4 steps. The total never changes after the type is chosen. Labels are step names, not field names.
3. **Back** on every step that has not yet persisted anything. Once the company exists, the flow goes forward only (no orphan duplicates).
4. **Company = name + first team on one screen.** Team name is prefilled (`Zespół główny`) and editable. NIP/address are not asked — they live in "Edit company data". If the team call fails after the org was created, retry creates only the team.
5. **Bulk PDF is a real drop zone** (drag & drop + file picker, PDF filter), parses each file, shows an editable review list (name, top 5 talents, remove), and adds all in one action. Partial failures are marked per row; successful rows are removed from the list; the action can be retried for the rest.
6. **Plan limits:** `checkLimit('client_orgs')` before creating a company; `checkLimit('profiles', N)` with the real N on file selection and before submit. Backend stays the enforcement point.
7. **Locale:** PDF parsing uses the UI locale (as the team page does), not hardcoded `pl`.
8. **Done screen** offers: open profile / open team matrix (sets the active org, full navigation — same mechanism as the dashboard client card), copy profile link(s), add another client, close (dialog only).
9. **Lists refresh** after every mutation (`onChange` callback), so closing the dialog mid-flow never leaves stale lists.
10. **Wizard resume** is preserved: company without a team → team step; team without people → people step; otherwise dashboard.
11. All copy in a new `addClient` namespace in `messages/pl.json` and `en.json` (identical key sets). No hardcoded strings.

### Entry points

| Place | Action |
|---|---|
| Coach dashboard header | Primary `Dodaj klienta` (dialog); `Zarządzaj klientami` becomes secondary |
| Coach dashboard empty state | `Dodaj pierwszego klienta` → dialog (replaces the link to `/dashboard/onboarding`). The duplicate "finish setup" banner is removed — for a coach with zero clients it led to the same flow. |
| `/dashboard/organizations` (coach) | Header `Dodaj klienta` → dialog preselected by tab (Firmy → company, Indywidualni → person); company empty state → dialog |
| Individuals tab empty state | `Dodaj klienta indywidualnego` → dialog |
| Non-coach roles | Unchanged (existing "Add organization" modal) |

### Files

- New: `frontend/components/clients/add-client/{AddClientFlow,PersonForm,PdfBatchImport,AddClientDialog,parseGallupPdf}.tsx|ts`
- Rewrite: `frontend/components/onboarding/CoachWizard.tsx` (thin wrapper)
- Modify: `frontend/components/dashboard/CoachDashboard.tsx`, `frontend/app/(dashboard)/dashboard/organizations/page.tsx`, `frontend/components/clients/IndividualClientsTab.tsx`
- i18n: `frontend/messages/{pl,en}.json` (`addClient.*`, `clients.emptyCta`, `clients.subtitleCoach`, `dashboard.coach.addClient`; dead `onboarding.coach.*` keys removed)

### Proof

- [x] `npm run lint` (0 errors; 7 pre-existing warnings) and `npm run build` pass.
- [x] `pl.json` / `en.json` key sets identical (`pl-only [] / en-only []`).
- [x] `grep -rn "onboarding.coach.resume" frontend/` → no results.
- [x] Local E2E (Chromium, SQLite backend, PDF parse mocked in the browser) covers QA items 1–10.
- [ ] Manual QA on DEV with real Gallup PDFs (parsing itself was mocked locally).

---

## 4. P2 — "First steps" checklist

A dismissible card at the top of the coach dashboard, items auto-completed from data (no manual ticks):

| # | Item | Done when | CTA |
|---|---|---|---|
| 1 | Uzupełnij swój profil i wizytówkę | coach has talents | `/dashboard/my-talents` |
| 2 | Dodaj pierwszego klienta | `totals.clients + individual_clients > 0` | Add client dialog |
| 3 | Wyślij klientowi link do profilu | `profile_link_copied` happened (localStorage until P4 lands, then the event) | Clients list |
| 4 | Pokaż zespołowi matrycę talentów | a team with ≥ 2 profiled members was opened, or presentation link created | Team page / presentation |
| 5 | Zapytaj AI o klienta | coach has ≥ 1 QA query | `/dashboard/qa` |

- Hidden automatically when all items are done; "Ukryj" persists per user (localStorage is acceptable for v1).
- Done screen of the Add client flow gets a "Co dalej?" block with items 3–5 contextualised to the client just added.
- Backend: extend `GET /api/dashboard/coach-overview` with `coach_has_talents: bool` and `qa_queries: int` (cheap counts). No migration.

**Proof:** a new coach account sees 0/5; after the P1 flow + copying a link, 3/5 are ticked without refresh hacks; a backend test covers the two new fields.

---

## 5. P3 — Polish and de-duplication

1. Team page bulk import (`teams/[id]/page.tsx`) switches to `PdfBatchImport` (review before add, instead of add-on-select). Keep the talent-ID mapping path or move to `saveTalents` — pick one and test it.
2. Coach "Add organization" modal on `/organizations` is fully replaced by the flow (done in P1); remaining hardcoded strings on the clients page and org cards go to i18n.
3. `/dashboard/users` "Invite" dialog: translate, or redirect coaches to the flow (they should never land there).

**Proof:** `grep -n "parsePdf" frontend/app frontend/components` shows a single call site in `parseGallupPdf.ts` (plus own-profile import).

---

## 6. P4 — Funnel analytics

Minimal, vendor-agnostic `track(event, props)` in `frontend/lib/analytics.ts` with a pluggable sink (start: `POST /api/events` into a simple table, or GA4 via GTM if already present on the marketing site — decide before implementation, this is the one open question).

Events: `register_role_selected`, `register_completed`, `add_client_started {source, type}`, `add_client_completed {type, people, via_pdf}`, `profile_link_copied`, `first_steps_item_completed {item}`.

No personal data in properties (no names, emails, talents).

**Proof:** events visible in the sink for one end-to-end coach run on DEV.

---

## 7. Manual QA checklist (P1)

Coach account on DEV (trial active):

1. Fresh coach → onboarding → company path: name + default team → drop 3 PDFs → review → "Dodaj wszystkich" → done → "Otwórz matrycę" shows 3 people.
2. Onboarding → Back from company step returns to type choice; Skip leaves to the dashboard.
3. Dashboard → `Dodaj klienta` → person → PDF → name auto-filled → no email → done → copy link opens `/aboutme/...` in a private window.
4. Dashboard → `Dodaj klienta` → second company → "Dodam osoby później" → company appears on the dashboard with an empty team.
5. `/dashboard/organizations` → Indywidualni tab → header button preselects person; empty state button works.
6. Drag a non-PDF file onto the drop zone → ignored with a notice.
7. Free plan / exhausted limit → plan-limit modal appears before any parsing.
8. Close the dialog mid-company-flow → the company already shows in the list (no stale state).
9. English UI → all copy translated, PDF talent names in English.
10. Mobile width (375 px): dialog scrolls, buttons reachable.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Wizard rewrite regresses onboarding (most important funnel step) | Same API calls as before; resume logic preserved; QA items 1–2 |
| Partial bulk failures create duplicates on retry | Successful rows removed from the review list immediately |
| Dialog opened in a client-org context creates people in the wrong org | All calls pass explicit `team_id` / `organization_id`; active org is changed only on "open matrix" |
| Team page keeps its own bulk import until P3 | Accepted short-term duplication; removed in P3 |
| P5 deferred: global org switcher remains confusing | Accepted for this iteration; P1 removes the need to touch it for adding clients |
