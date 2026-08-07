# Implementation Brief — Coach signup & onboarding rework

**Status:** ready for implementation
**Owner:** implementing agent
**Reviewer:** Kamil (post-implementation review)
**Date:** 2026-08-06

---

## 1. Objective

Reduce friction and ambiguity in the coach acquisition funnel.

Today the coach path has three problems:

1. Role choice is hidden in a footer link (`/register` → tiny link → `/register/coach`). Most coaches never see it and sign up as an organization admin, landing in the wrong product surface.
2. `organization_name` is a required field on `/register`. For a coach it is meaningless; for a company admin it is a decision ("What do I type? Legal name? Brand?") placed *before* any value is delivered. It is the single highest-drop field in the form.
3. The coach onboarding wizard asks for data the product can already derive (full name is in the Gallup PDF) and data it does not need (client email), while the profile settings show B2B-employee fields (Stanowisko PL/EN) that are irrelevant for a coach.

**Success = a coach can go from landing on `/register` to seeing a client's talent profile with: role choice → email + password + name → upload PDF → done.** No company name, no client email, no job title.

**Non-goals:** billing, multi-coach teams, redesign of the dashboard.

---

## 2. Scope summary

| # | Change | Area |
|---|---|---|
| A | Single `/register` with explicit role selection | frontend + i18n |
| B | Remove `organization_name` from registration entirely | frontend + backend + migration |
| C | Coach wizard: PDF-first, name auto-filled from PDF, email optional | frontend + backend |
| D | Hide job-title fields for `role === "coach"` | frontend |
| E | Coach-specific UX improvements (section 7) | frontend |

Sections A–D are required. Section E is prioritized separately (E1–E4 in this iteration, E5+ backlog).

---

## 3. A — Single registration page with role selection

### Target UX

`/register` becomes a two-step client-side flow (no route change between steps, no page reload):

**Step 1 — "Jak chcesz korzystać z TalentPilot?"** — two large selectable cards:

| Card | Icon | Title | Description |
|---|---|---|---|
| coach | `UserCog` (lucide) | Jestem coachem | Pracuję z klientami indywidualnymi i zespołami w oparciu o talenty Gallupa |
| company | `Building2` (lucide) | Reprezentuję firmę / zespół | Chcę rozwijać talenty w mojej organizacji |

Clicking a card advances immediately to step 2 (no separate "Dalej" button — one less click).

**Step 2 — form.** Identical fields for both roles:

- `full_name` (required)
- `email` (required)
- `password` (required, min 8)
- Submit: coach → `Załóż konto coacha`; company → `Utwórz konto`

Above the form: a small chip showing the chosen role with a `Zmień` link back to step 1. Keep a `?role=coach|company` query param in sync via `router.replace` so the step is deep-linkable and shareable, and so we can attribute traffic.

### Routing / compatibility

- `/register/coach` **must keep working** (it is linked from marketing/emails). Convert it into a thin redirect to `/register?role=coach`. Do not delete the route.
- On mount, `/register` reads `?role=` and skips step 1 when the value is `coach` or `company`.
- Submit handler dispatches to `api.auth.registerCoach` (coach) or `api.auth.register` (company).
- Post-signup redirect: coach → set `onboarding=1` cookie → `/dashboard/onboarding` (existing behaviour). Company → `/dashboard`.

### Files

- Rewrite: `frontend/app/(auth)/register/page.tsx`
- Replace with redirect: `frontend/app/(auth)/register/coach/page.tsx`
- Extract the shared form into `frontend/components/auth/RegisterForm.tsx` to avoid duplicating the field markup and the `getErrorMessage` helper (currently copy-pasted in both files).

### i18n

Add under `auth.register` in **both** `frontend/messages/pl.json` and `en.json`. Remove now-dead keys `auth.register.coachCta` / `coachLink`, and fold `auth.registerCoach.*` into the shared block (keep `registerCoach.submit` / `submitting` as role-specific CTA labels).

```json
"auth": {
  "register": {
    "roleStepTitle": "Jak chcesz korzystać z TalentPilot?",
    "roleCoach": "Jestem coachem",
    "roleCoachDesc": "Pracuję z klientami indywidualnymi i zespołami w oparciu o talenty Gallupa",
    "roleCompany": "Reprezentuję firmę lub zespół",
    "roleCompanyDesc": "Chcę rozwijać talenty w mojej organizacji",
    "roleChange": "Zmień",
    "roleChipCoach": "Konto coacha",
    "roleChipCompany": "Konto firmowe"
  }
}
```

**Important:** the current `/register` hardcodes the English string `"Organization Name"` and placeholder `"Acme Inc."` while every other label is translated. That field disappears (section B) — make sure no hardcoded English strings remain on the page.

### Acceptance criteria

- [ ] `/register` shows role cards first; no form fields visible until a role is picked.
- [ ] `/register?role=coach` opens directly on the form with the coach chip.
- [ ] `/register/coach` redirects to `/register?role=coach` (301/`redirect()`), no 404.
- [ ] No `organization_name` input anywhere.
- [ ] All copy comes from `messages/*.json`; no hardcoded English.
- [ ] Coach signup still lands on `/dashboard/onboarding` with the wizard.

---

## 4. B — Remove `organization_name` from registration

### Backend

`backend/schemas.py`:

```python
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=255)
    organization_name: Optional[str] = Field(None, min_length=1, max_length=255)
```

Keep the field optional rather than deleting it — existing API clients and tests keep working, and the field is still useful for a future invite/sales-assisted flow.

`backend/routers/auth.py::register()`:

```python
org_name = (data.organization_name or "").strip() or f"{data.full_name} — Organizacja"
organization = Organization(
    name=org_name,
    name_confirmed=bool((data.organization_name or "").strip()),
)
```

### Migration

New Alembic revision in `backend/alembic/versions/`:

- Add `organizations.name_confirmed` — `Boolean, nullable=False, server_default=sa.true()`.
- Rationale for `true` default: all *existing* organizations were created with a user-supplied name, so they are already confirmed. Only new placeholder orgs get `false`.
- Downgrade drops the column.

Also expose `name_confirmed` on `OrganizationResponse` so the frontend can react to it.

**Coach path:** unchanged — `register_coach()` already derives `f"{full_name} — Coaching"` with `is_workspace=True`. Set `name_confirmed=True` there (a workspace org's name is never user-facing, so it must not trigger the prompt).

### Where the company name is collected instead

Deferred to *after* the first value moment. Two touchpoints, both cheap:

1. **Dismissible banner on `/dashboard`** when `role in ("admin","manager")` and the active org has `name_confirmed === false`: *"Uzupełnij nazwę firmy, żeby Twój zespół rozpoznał zaproszenia"* → inline single-field save → `PATCH /api/organizations/{id}`.
2. **Hard gate before the first invitation is sent.** In the invite-user dialog, if `name_confirmed === false`, require the org name first (it appears in the invitation email — sending "Jan Kowalski — Organizacja zaprasza Cię…" would look broken). Prefer a modal with one field over blocking the CTA.

This is the trade-off to state explicitly: we move a required field from before signup (where it costs conversion) to before the first outbound email (where it actually matters).

### Acceptance criteria

- [ ] `POST /api/auth/register` succeeds with `{email, password, full_name}` only.
- [ ] Org created without a name gets a placeholder + `name_confirmed = false`.
- [ ] Existing tests in `backend/tests/` pass; add cases for the no-name path and for the placeholder format.
- [ ] Banner appears for unconfirmed orgs, disappears after save, stays dismissed for the session.
- [ ] Invitation cannot be sent while `name_confirmed === false`.

---

## 5. C — Coach wizard: PDF-first person creation

**File:** `frontend/components/onboarding/CoachWizard.tsx` (`personForm`, `submitPerson`).

### Current problems

- `personForm` asks for name and email up front, then optionally accepts a PDF — and **discards `parsed.first_name` / `parsed.last_name`** returned by `api.gallup.parsePdf`. The data is already there and is thrown away.
- Email is `required` and gates the submit button (`disabled={... || !personEmail || ...}`). A coach onboarding a client from a PDF often does not have (or should not enter) the client's email yet.
- The same problem exists in the bulk import at `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` (~line 263), which fabricates client-side emails: `user_${Date.now()}_${i}@example.com`. That is a leaky workaround using a real, reserved domain (`example.com`) and must be replaced by the backend mechanism below.

### Target flow (matches the existing team-matrix import, so behaviour is consistent across the product)

Reorder the person step to **source-first**:

1. **Krok 1 — skąd wziąć dane?** radio: `Raport Gallup (PDF)` (default) / `Zaproszę klienta mailem` / `Dodam ręcznie`.
2. **PDF branch:** file input (accept `application/pdf`) → on file select, immediately call `api.gallup.parsePdf(file)` and show a spinner.
   - On success: prefill `personName` with `` `${first_name ?? ""} ${last_name ?? ""}`.trim() ``; fall back to the filename without `.pdf` when the parser returns nothing. Show the field as an **editable** input labelled *"Imię i nazwisko (z raportu)"* with a subtle "wykryte automatycznie" hint, and render a read-only preview of the top-5 detected talents as a correctness signal.
   - Keep the parsed `rankings` in state so `submitPerson` does not re-upload the file.
   - On parse failure: show `t("pdfParseError")`, keep the file, and let the coach type the name manually — never block.
3. **Email — optional.** Label `Email (opcjonalnie)`, no `required`, helper text: *"Potrzebny tylko wtedy, gdy chcesz, żeby klient sam zalogował się do TalentPilot."* Remove `!personEmail` from the submit `disabled` condition.
   - Exception: when the source is `Zaproszę klienta mailem`, email becomes required — enforce conditionally.
4. Submit enabled when: `personName` is non-empty **and** (source ≠ `pdf` or a parse result exists).

### Backend — optional email on ghost invites

`backend/schemas.py`:

```python
class GhostInviteCreate(BaseModel):
    email: Optional[EmailStr] = None
    ...
```

`backend/routers/invitations.py::create_ghost_invite()`:

- When `data.email` is falsy, generate a placeholder: `f"ghost+{uuid4().hex}@placeholder.talentpilot.local"`.
- Add a module-level helper `PLACEHOLDER_EMAIL_DOMAIN = "placeholder.talentpilot.local"` and `def is_placeholder_email(email: str) -> bool`.
- Skip the `existing_user` lookup when the email is generated (it is unique by construction).
- **Do not send any email** to a placeholder address. Guard `send_invitation_email` / `resend_invitation` and return a 400 (`"User has no email address"`) if a caller tries to invite a placeholder user.

Rationale for the placeholder over making `users.email` nullable: `email` is `unique` and is the login lookup key across auth, invitations and password reset. Making it nullable is a wide, hard-to-reverse change for one flow. A namespaced placeholder in a reserved `.local` domain is contained, obviously synthetic, and trivially upgradable — when a real email is later supplied, just overwrite the column.

Also: anywhere a placeholder email would be rendered (user detail page, team member list, public profile, CSV export), render nothing instead of the synthetic string. Add a small frontend helper `isPlaceholderEmail()` in `frontend/lib/utils.ts` and use it in `dashboard/users/[id]`, `dashboard/teams/[id]` and `aboutme/[token]`.

### Follow-up cleanup (same PR)

Replace the fabricated `user_${Date.now()}_${i}@example.com` in `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` with omitting `email` from the payload. The bulk-import UX there is the reference implementation — keep the wizard consistent with it.

### Acceptance criteria

- [ ] Uploading a Gallup PDF in the wizard prefills the name; the field stays editable.
- [ ] A person can be added with **no email at all**; they appear in the team/organization list.
- [ ] Talents from the PDF are saved (existing `api.gallup.saveTalents` call still runs, using cached rankings — the PDF is uploaded once, not twice).
- [ ] `resendInvitation` on a placeholder-email user returns 400, does not send mail.
- [ ] No `@example.com` address is generated anywhere in the frontend.
- [ ] `backend/tests/test_coach_onboarding.py` and `test_gallup_api.py` extended for the no-email path.

---

## 6. D — Hide job-title fields for coaches

**File:** `frontend/app/(dashboard)/dashboard/settings/page.tsx` (~lines 590–610).

- Wrap the `Stanowisko (PL)` / `Stanowisko (EN)` grid in `{user?.role !== "coach" && ( … )}`.
- Do **not** clear `job_title` / `job_title_en` in the DB — hiding is reversible, deleting is not. If a user's role later changes to admin/manager the data returns.
- Do not send `job_title` / `job_title_en` in the coach's save payload (avoid a hidden field silently overwriting a value with an empty string).
- Also skip the `api.users.translateProfile()` auto-translate of the job title for coaches.
- The labels are currently hardcoded Polish (`"Stanowisko (PL)"`) although `settings.jobTitle` / `settings.jobTitleEn` keys already exist in `messages/*.json` — switch to `t("jobTitle")` / `t("jobTitleEn")` while touching this block.

**Public profile:** `frontend/app/aboutme/[token]/page.tsx` line ~169 computes `displayJobTitle`. Verify that a null/empty value renders no empty element and collapses the layout gap cleanly — a coach's card must not show a blank line where the job title used to be.

### Acceptance criteria

- [ ] Coach settings page shows no "Stanowisko" fields.
- [ ] Admin/manager/user settings are unchanged.
- [ ] Saving as a coach does not modify `job_title` / `job_title_en` in the DB.
- [ ] `/aboutme/{token}` for a coach renders without a gap or empty label.

---

## 7. E — Coach-role UX recommendations

Prioritized by (business impact ÷ effort). **E1–E4 in this iteration.** E5+ are backlog — do not implement without approval.

### E1 — Bulk PDF drop in the wizard *(highest leverage)*

The wizard adds people one at a time. A coach's real first job is a whole team — 6–12 Gallup PDFs. The mechanism already exists in `dashboard/teams/[id]/page.tsx`.

Change the wizard's `people` step to a **multi-file drop zone**: accept N PDFs, parse each, show a review table (`plik → wykryte imię i nazwisko → top 5 talentów → ✓/✗`) with editable names and per-row remove, then one `Dodaj wszystkich` action. Keep single-person add as the fallback for the individual-client path.

*Impact:* cuts time-to-first-matrix from ~10 minutes to ~1. This is the moment a coach decides whether the product is worth it.

### E2 — Progress indicator + honest expectations

The wizard has no step counter and no sense of length; the only escape is a grey `Pomiń` link. Add `Krok 2 z 3` plus a one-line preview on the role card at signup: *"Zajmie ~2 minuty. Potrzebujesz raportu Gallupa w PDF."* Setting expectations before the first step measurably reduces mid-wizard abandonment. Make `Pomiń` a normal secondary button, not a de-emphasised underline — a hidden exit reads as a trap and costs trust.

### E3 — Role-aware terminology

A coach sees "Organizacje" and "Użytkownicy" — B2B-admin language for someone who has *clients*. Introduce a role-based label map (a `useRoleLabels()` hook reading `role` once, not scattered ternaries):

| Generic | Coach sees |
|---|---|
| Organizacje | Klienci |
| Użytkownicy | Osoby / Klienci indywidualni |
| Zespoły | Zespoły klienta |
| Zaproś użytkownika | Dodaj klienta |

Sidebar in `frontend/app/(dashboard)/layout.tsx` already branches on role — extend that, don't fork it.

### E4 — Share-link instead of email invitation

Email is friction and often unavailable at the time a coach sets up a client. The product already has `public_token` / `public_slug` and a public `/aboutme/{token}` profile. Surface a **`Skopiuj link do profilu`** action right at the end of the wizard and on every client row. The coach sends it via whatever channel they already use with that client (WhatsApp, their own email, a session). Zero setup, no email field, and it becomes the natural artefact the coach shares — which is also organic distribution for TalentPilot.

Pair with an explicit visibility control (`public_profile_settings` exists) so the coach can decide what the link exposes before sharing.

### E5+ — Backlog (do not implement now)

- **Coach branding on the public profile** — coach's name/logo/contact footer on `/aboutme/{token}`. The coach's client-facing artefact currently carries only TalentPilot's brand; coaches will want their own. Likely a paid-tier hook.
- **Client-level notes / session log** — coaches work in sessions over time; there is no place to record what was worked on.
- **Empty states with a single CTA** on `/dashboard/organizations` and the clients list (currently likely a bare empty table).
- **Coach excluded from his own workspace org member lists** — verify he is not rendered as a "team member" of his own `is_workspace` org.
- **Analytics events** on the funnel: `register_role_selected`, `register_completed`, `wizard_step_viewed`, `wizard_pdf_parsed`, `wizard_completed`, `wizard_skipped`. Without these we are guessing about the very drop-offs this brief claims to fix. Cheap to add now, worthless to add retroactively.

---

## 8. Risks & explicitly accepted trade-offs

| Risk | Mitigation |
|---|---|
| Placeholder emails leak into UI or outbound mail | Namespaced `.local` domain + `is_placeholder_email()` guard on every send path + frontend render guard. Covered by tests. |
| Company admins never fill in the org name | Hard gate before the first invitation (section 4). Accepted: some orgs will sit with a placeholder name until they invite someone. Reversible. |
| Two-step registration adds a click for company admins | Accepted. The click replaces a text field and makes the product's two audiences legible. Net friction is lower. |
| `/register/coach` links in the wild break | Route kept as a redirect. Verify with a manual hit before deploy. |
| Migration default (`name_confirmed = true`) hides genuinely bad legacy org names | Accepted — out of scope. Legacy orgs did supply a name. |

**Accepted technical debt:** synthetic placeholder emails instead of a nullable `users.email`. Revisit when/if a second flow needs emailless users, or when `users.email` is refactored for SSO. Documented here so it is not rediscovered as a bug.

---

## 9. Definition of done

1. All acceptance criteria in sections 3–6 pass.
2. Backend: `pytest backend/tests/` green, including new cases for register-without-org-name and ghost-invite-without-email.
3. Alembic migration applies **and rolls back** cleanly on a copy of the current DB.
4. Manual pass on both funnels end to end:
   - coach: `/register` → role card → email+password+name → wizard → PDF upload → name auto-filled → add with no email → talent profile visible;
   - company: `/register` → role card → form → dashboard → org-name banner → save → invite works.
5. No hardcoded user-facing strings introduced; `pl.json` and `en.json` have identical key sets (add a check if one does not exist).
6. `docs/DEVLOG.md` updated with the decisions: org name deferred post-signup, placeholder-email approach, role-based field visibility.
7. Short summary of what was implemented vs. deferred, for review.
