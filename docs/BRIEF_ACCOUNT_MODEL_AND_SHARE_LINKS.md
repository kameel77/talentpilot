# Implementation Brief #2 — Account model (personal → organization) & working share links

**Status:** ready for implementation
**Owner:** implementing agent
**Reviewer:** Kamil (post-implementation review)
**Date:** 2026-08-06
**Supersedes parts of:** `docs/BRIEF_COACH_SIGNUP_ONBOARDING.md` (section 4 — the org-name banner is being removed, see §2)

---

## 0. Read this first — how "done" is defined in this brief

The previous two rounds both reported items as "implemented and verified" that did not work:

- Round 1: the org-name banner was reported as added. It did not exist in the codebase at all.
- Round 2: the E4 share link was reported as fixed. `GhostInviteResponse` was correctly extended, but `create_ghost_invite` never assigns `public_token`, so the API returns `null` and the button never renders. A green build and passing tests did not catch it, because no test covered the behaviour.

**Therefore, in this brief every requirement carries a required proof artifact.** A task is not done when the code is written; it is done when the listed proof exists and passes. Do not report an item as complete without running its proof and pasting the result.

"Build passes" and "lint clean" are necessary but never sufficient evidence for any item below.

---

## 1. Objective

Two coupled changes:

1. **Account model.** Registration currently forces every non-coach into being an *organization admin* with a fabricated company name. Many users are individuals with no organization. Move to a **personal account that upgrades into an organization at the moment it becomes real** (first team, first invitation).
2. **Share links actually work.** The "send the client a profile link instead of an email" flow — the whole point of removing the email requirement — is currently non-functional end to end.

These ship together because the first one deletes code the second one would otherwise have to accommodate.

---

## 2. Remove the org-name banner (do this first)

The dashboard banner added in the previous round is a workaround for the org-first model this brief replaces. Under the new model the organization name is asked exactly once, inline, at the upgrade moment (§4). The banner becomes dead code.

**Actions:**

- Remove the unconfirmed-org-name banner block from `frontend/app/(dashboard)/dashboard/page.tsx`, including the `org` / `orgNameInput` / `savingOrg` / `orgSaveError` state and the extra `api.organizations.get()` call in the loader.
- Remove the soft warning block from the add-member form in `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` (it is replaced by a real modal in §4).
- **Keep** `organizations.name_confirmed` (column, schema field, `PATCH` auto-confirm logic). It is still the flag that decides whether the upgrade prompt fires. Do not revert the migration.

Do not spend time translating or hardening this banner — it is being deleted.

**Proof:** `grep -rn "name_confirmed" frontend/app` returns only the upgrade-modal usages from §4, and no results in `dashboard/page.tsx`.

---

## 3. Registration: personal account, not organization admin

### Copy

`/register` keeps two cards. Reframe the axis from "company vs not" to **"for whom do you work"** — that is the real product fork (a coach has no "Moje talenty" tab and works on other people's profiles).

| Card | PL label | PL description |
|---|---|---|
| personal | **Dla siebie i swojego zespołu** | Chcę poznać i rozwijać talenty — własne lub osób, z którymi pracuję |
| coach | **Jestem coachem** | Pracuję z klientami indywidualnymi i zespołami |

Rename the internal role value `"company"` → `"personal"` (query param `?role=personal`; keep `?role=company` accepted as a silent alias so existing links do not break). Update `auth.register.roleCompany` / `roleCompanyDesc` keys accordingly — rename to `rolePersonal` / `rolePersonalDesc`, and update `roleChipCompany` → `roleChipPersonal` ("Konto osobiste").

Delete the orphan key `auth.register.companyExpectation` from both `pl.json` and `en.json` — it is unused and its text ("Potrzebujesz raportu Gallupa w PDF") belongs to the coach card, not this one.

### Backend — `register()` creates a personal workspace

```python
workspace = Organization(
    name=f"{data.full_name} — Moje konto",
    is_workspace=True,
    name_confirmed=False,
)
```

- Keep `role=UserRole.ADMIN`. This is deliberate: admin of one's own empty workspace is a superset of permissions over one's own data, harms nobody, and does not pre-commit us to any pricing model. **Do not implement role assignment based on plans** — no plans are defined yet, and role migrations are the ugliest debt to unwind. When plans exist we restrict downward, which is easier than expanding upward.
- `name_confirmed=False` marks "this name is a placeholder" and is what triggers the upgrade prompt in §4.
- `register_coach()` stays as it is (`is_workspace=True`, `name_confirmed=True` — a coach's workspace name is never user-facing).
- Keep `organization_name` optional in `RegisterRequest`. If supplied (future sales-assisted flow), create a **normal** org: `is_workspace=False, name_confirmed=True`, exactly as today.

**Proof:**
- Test: `POST /api/auth/register` with `{email, password, full_name}` → the created user's organization has `is_workspace is True` and `name_confirmed is False`.
- Test: same call **with** `organization_name` → `is_workspace is False` and `name_confirmed is True`.

---

## 4. The upgrade moment: personal workspace → organization

### Why this is the critical part

`is_workspace=True` is currently a **hard dead end**, by design, in three places:

- `backend/routers/teams.py:82` — "Cannot create teams in a private workspace"
- `backend/routers/invitations.py:123` — "Cannot invite into a workspace team"
- `backend/routers/external.py:203` — same guard on the external intake path
- (`backend/routers/dashboard.py:143` also filters workspaces out of the coach's client list)

If we drop individuals into a workspace without an exit, **they can never grow into a team.** That would close the expansion path for exactly the segment most likely to convert to a paid plan. The upgrade endpoint is not optional polish — it is what makes §3 safe.

### New endpoint

```
POST /api/organizations/{organization_id}/upgrade
body: { "name": str }   # 1..255, stripped, non-empty
```

Behaviour:

- Authorization: caller must be `admin` of that organization (reuse the existing `check_org_access` / `_accessible_org_ids` pattern — do not invent a new access check).
- 400 if `organization.is_workspace is False` — already an organization, nothing to upgrade.
- **403 if the organization belongs to a coach** (`owner user's role == COACH`). A coach's workspace is a private container for individual clients and must never become a client organization — coaches create client orgs explicitly via the wizard. This is the one case where the guard must stay.
- On success: set `name = data.name.strip()`, `is_workspace = False`, `name_confirmed = True`. Commit, return `OrganizationResponse`.

### Frontend trigger

The prompt fires at the two moments where an organization becomes real — **not** on a banner, **not** on a timer:

1. Creating the first team (`/dashboard/teams`, "Utwórz zespół")
2. Inviting the first person (`/dashboard/users`, `/dashboard/teams/[id]` add-member)

When `activeOrg.is_workspace === true`, intercept the action with a **modal**, before the underlying form:

> **Nazwij swoją organizację**
> Zaczynasz pracować z zespołem — podaj nazwę, która pojawi się w zaproszeniach i na profilach.
> `[ pole: np. Acme sp. z o.o. ]` `[ Kontynuuj ]`

On submit: call the upgrade endpoint, refresh the cached org, then continue seamlessly into the originally requested action (create-team form / invite form). **Do not** make the user re-click the original button — the modal is a step inside their flow, not a detour.

Build this as one reusable component, `frontend/components/organizations/UpgradeWorkspaceModal.tsx`, used by all trigger points. Do not copy-paste the modal into three pages.

**Proof:**
- Test: `POST /upgrade` on a personal workspace → 200, and the org now has `is_workspace False`, `name_confirmed True`, correct name.
- Test: `POST /upgrade` on a coach's workspace → 403.
- Test: `POST /upgrade` on an already-normal org → 400.
- Test: after upgrade, `POST /api/teams` for that org succeeds (this is the regression that proves the dead end is gone — it must fail before the upgrade and pass after).
- Manual: fresh personal signup → click "Utwórz zespół" → modal → name → team form opens prefilled/continued without re-clicking.

---

## 5. Share links must work end to end

This is the item reported as fixed twice and still broken. **Decision taken: a ghost client's public profile is visible by default** (see §5.3 for the exact exposure boundary).

### 5.1 — Ghosts get a public token

`backend/routers/invitations.py::create_ghost_invite()` creates the `User(...)` without `public_token`. The column is `nullable=True` with no default, and tokens are only assigned in `auth.py`, `users.py` and `admin.py`. Add it to the ghost creation path, using the same generator as everywhere else:

```python
public_token=str(uuid.uuid4()).replace("-", ""),
```

Also backfill: **new Alembic migration** assigning a token to every existing `users` row where `public_token IS NULL` (ghosts created before this change would otherwise stay permanently unshareable). Generate per-row in Python within the migration; do not use a single constant — the column is `unique`.

### 5.2 — Public profile resolves for ghosts

`backend/routers/public.py::get_public_profile()` filters `User.is_active == True` in **both** the slug and the token branch. Ghosts are `is_active=False`, so even a valid token 404s. Change both filters to:

```python
sa.or_(User.is_active == True, User.is_ghost == True)
```

Keep the rest of the endpoint untouched — `public_profile_settings` (defaulting to `_DEFAULT_SETTINGS`) remains the visibility control over *which fields* are exposed, and `show_blockers` stays `False` by default.

### 5.3 — Exposure boundary (state this explicitly in the DEVLOG)

What this opens: anyone holding a 32-hex-character random token can view a ghost client's profile, limited to the fields enabled in `public_profile_settings`. This is the same exposure model already in place for active users — unguessable-token access, no enumeration, no listing endpoint. What it does **not** open: no email address (already masked via `isPlaceholderEmail`), no login, no org data, no listing of other users.

Do not add the token to any list response, search result, or export beyond what already exists.

### 5.4 — Frontend

`CoachWizard` already reads `ghost.public_token` / `ghost.public_slug` on both the single and bulk paths — no change needed there once the backend returns real values. Verify the button now renders.

**Proof (this is the one that would have caught both previous failures):**
- Integration test: create a ghost via `POST /api/invitations/ghost` (no email) → assert `public_token` in the response is **not None** → `GET /api/public/{public_token}` returns **200** with the expected `full_name`.
- Test: the same endpoint still 404s for a random non-existent token.
- Test: migration backfill — a user row with `public_token = NULL` before upgrade has a non-null unique token after.
- Manual: coach wizard → bulk-upload 2 PDFs → "Dodaj wszystkich" → "Link" button appears on both rows → open the copied URL in a private window → profile renders.

---

## 6. Carry-over defects from the previous round

### 6.1 — i18n regression in newly added code

The banner (`dashboard/page.tsx`) and the add-member warning (`teams/[id]/page.tsx`) were written with hardcoded Polish, reintroducing the exact problem just fixed in `CoachWizard`. Both blocks are deleted in §2, so the fix is the deletion — but **the new modal in §4 must use `useTranslations` from the start**, with keys added to both `pl.json` and `en.json`.

**Proof:** `grep -n "[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]" frontend/components/organizations/UpgradeWorkspaceModal.tsx` returns nothing, and PL/EN key sets remain identical (the parity check below).

### 6.2 — Layering inversion on `is_placeholder_email`

`backend/services/email_service.py` and `backend/routers/users.py` import `is_placeholder_email` from `routers.invitations`, using a function-local import to dodge a circular dependency. A service must not depend on a router.

Move `PLACEHOLDER_EMAIL_DOMAIN` and `is_placeholder_email` to a shared module (`backend/utils.py` or `backend/services/email_utils.py`), import it normally at module top-level in all three consumers, and delete the local imports. The domain-parsing logic itself is correct — do not change its behaviour.

**Proof:** `grep -rn "from routers.invitations import" backend/services backend/routers` returns nothing; tests still pass.

### 6.3 — Do not re-add the soft invite gate

The warning was cosmetic (it only appeared once an email had been typed and blocked nothing). The §4 modal replaces it with a real, blocking prompt at the correct moment.

---

## 7. Out of scope — do not implement

- Plan/pricing tiers and any role assignment derived from them.
- A third registration card. Two cards plus the upgrade moment covers the space; a third forces a decision the user cannot make yet.
- Coach branding on public profiles, client session notes, analytics events. Still backlog.

---

## 8. Definition of done

Report completion **item by item, each with its proof output pasted**. An item without its proof is not done.

1. §2 — banner and soft gate removed; `grep` proof.
2. §3 — registration creates a personal workspace; both tests pass.
3. §4 — upgrade endpoint + reusable modal; all four tests pass, including the create-team-after-upgrade regression.
4. §5 — ghost token assignment, backfill migration, public profile resolution; the integration test asserting `GET /api/public/{token} == 200` for a ghost passes.
5. §6 — shared placeholder helper, no router imports in services; grep proof.
6. Migration applies **and rolls back** cleanly on a copy of the current DB (both new migrations).
7. `pytest backend/tests/` green. Note: `test_gallup_api.py::test_parse_pdf_unauthorized` fails with `403 != 401` on some FastAPI versions — this is a known pre-existing environment artifact, unrelated; report it separately rather than "fixing" it.
8. `npx tsc --noEmit` clean; `npm run lint` clean.
9. PL/EN key parity — run and paste the output:
   ```bash
   cd frontend && python3 -c "
   import json
   def flat(d,p=''):
       o=set()
       for k,v in d.items():
           kk=f'{p}.{k}' if p else k
           o|=flat(v,kk) if isinstance(v,dict) else {kk}
       return o
   pl=flat(json.load(open('messages/pl.json'))); en=flat(json.load(open('messages/en.json')))
   print('onlyPL:',sorted(pl-en)); print('onlyEN:',sorted(en-pl))"
   ```
   Both lists must be empty.
10. Manual end-to-end pass, both funnels:
    - **personal:** `/register` → "Dla siebie i swojego zespołu" → email+hasło+imię → dashboard (no banner) → "Utwórz zespół" → naming modal → team created → invite works;
    - **coach:** `/register?role=coach` → wizard → bulk 2 PDFs → "Dodaj wszystkich" → "Link" visible on both rows → link opens a working public profile in a private window.
11. `docs/DEVLOG.md` updated with: personal-workspace account model, the upgrade moment replacing the banner, and the ghost public-profile exposure boundary from §5.3 stated explicitly.
