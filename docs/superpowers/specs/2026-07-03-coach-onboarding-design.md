# TalentPilot — Coach Onboarding & Workspace Design

**Date:** 2026-07-03
**Approach:** A — Full path: dedicated coach signup + onboarding wizard + role-scoped UI
**Scope:** Self-serve coach registration, individual & organizational clients, 4-step wizard, sidebar narrowed for COACH role

---

## Goal

Make the COACH role a first-class actor with its own entry path and a UI limited
to what a coach actually needs: working with client organizations (team
matrices) and individual persons (profiles, user manuals, synergy). Coaches
drive adoption — they bring their clients into the app.

## Context (current state)

- `UserRole.COACH` exists; `OrganizationAccess` (models.py:136) grants a coach
  guest access to multiple organizations. Org switcher already in the header.
- Coach accounts can only be created by the superadmin (create user / change
  role in `admin.py`). No self-serve path — `/register` always creates
  ADMIN + a new organization.
- The existing `/dashboard/onboarding` page targets invited team members only
  ("upload YOUR Gallup PDF"), not coaches.
- Sidebar shows a coach the same items as a regular member (My Talents, Tips →
  Mój Ruch), which misrepresents the role.
- `users.organization_id` is `NOT NULL` and single-valued — every person lives
  in exactly one organization.
- `POST /invitations/ghost` requires `team_id` and derives the organization
  from the team; it accepts inline `talents[]`.
- Visibility: USER role sees only teammates (shared team); ADMIN/MANAGER/COACH
  see everyone in the active organization (dashboard.py).

---

## 1. Coach account model

### Self-serve registration

New page `/register/coach` → new endpoint `POST /auth/register-coach`:

- Creates a **private workspace** organization named `"{full_name} — Coaching"`.
  This satisfies the `NOT NULL` constraint and doubles as the default container
  for individual clients. It is **never** shown as a client.
- Creates the user with `role=COACH`, `organization_id=<workspace.id>`.
- Returns JWT (same shape as `/register`); frontend sets the `onboarding=1`
  cookie and redirects to the wizard.

New schema `RegisterCoachRequest`: `email`, `password`, `full_name`
(workspace name is generated, not user input).

Superadmin flows are unchanged: `POST /admin/users` (create coach directly) and
`PATCH /admin/users/{id}/role` (promote a regular user to coach) keep working.
A promoted user keeps their current organization as their workspace.

### Clients

A coach's client is either:

- **Individual person** — lives in the coach's workspace org by default.
- **Organization (team-based)** — a separate `Organization` linked via
  `OrganizationAccess` (existing mechanism).

**Default-container rule:** every person always belongs to some organization.
A client added by a coach defaults to the coach's workspace until the coach
re-pins them.

**Pin = move.** Pinning an individual client to an organization changes their
`organization_id` (plus optional team assignment). A person is either an
individual client or an org member — never both. Multi-membership (user↔org
many-to-many) is explicitly rejected at this stage.

**Privacy invariant:** individual clients in a coach's workspace are NEVER
placed in a shared team there. Under existing visibility rules (USER sees only
teammates) this guarantees that two individual clients of the same coach cannot
see each other if they log in.

---

## 2. Coach onboarding wizard

The existing `/dashboard/onboarding` page branches by role. Members keep the
current screen. Coaches get a 4-step wizard with a progress bar, **skippable
and resumable**.

Progress is computed from data, not stored, and adapts to the chosen path:

- has ≥1 client (org via `OrganizationAccess` or ≥1 individual in workspace)?
- has ≥1 team? (org path only — not required on the individual path)
- has ≥1 person with talents?

The wizard is complete when the coach has at least one client and at least one
person with talents; it then no longer appears.

### Steps

1. **Add your first client** — branch: "Who are you adding?"
   - **Person (individual):** name + email + one of: upload Gallup PDF now /
     send invitation / name only. Creates a ghost user in the coach's
     workspace. First value = person profile with talents & User Manual.
   - **Organization (team):** create org (`POST /api/organizations`, already
     creates `OrganizationAccess` for the coach) → continue to step 2.
2. **Create a team** in that client org (existing teams endpoint). Skipped for
   the individual path.
3. **Add people** — per person, coach chooses:
   - **Upload now:** PDF → `POST /gallup/parse-pdf` → ghost user with inline
     `talents[]` via `POST /invitations/ghost`, **no email sent**.
   - **Invite:** ghost user + invitation email (existing flow with
     Invited/Active/Expired statuses).
4. **Open the team matrix** (org path) or the person's profile (individual
   path) — the "first value" moment.

---

## 3. Role-scoped UI (COACH)

Sidebar (`frontend/app/(dashboard)/layout.tsx`) branches by role:

| Item | Member/Manager | Coach |
|---|---|---|
| Overview (dashboard) | ✅ | ✅ (per client) |
| My Talents | ✅ | ❌ hidden |
| Q&A | ✅ "about my talents" | ✅ reframed: "about this team/person" |
| Teams | ✅ | ✅ core |
| Compare (1:1 synergy) | ✅ | ✅ core |
| Tips → Mój Ruch | ✅ | ❌ hidden |
| Tips → Mosty (interaction guide) | ✅ | ✅ session-prep tool |
| Organizations → **Clients** | — | ✅ |

- Hiding = role condition in the nav + guards on the pages themselves
  (`/my-talents`, Tips "Mój Ruch") redirecting a coach away.
- Reframing Q&A/Tips in this iteration = labels and subject context (which
  team/person), NOT a rewrite of the RAG engine.
- Org switcher in the header: for coaches it is labeled **"Klient"** and
  **excludes the workspace org** (workspace = the org NOT granted via
  `OrganizationAccess` but equal to `user.organization_id`).

### New "Clients" view

Replaces "Organizations" in the coach sidebar. Two tabs:

- **Organizacje** — client orgs (existing organizations list, coach-scoped).
- **Indywidualni** — persons in the coach's workspace org. Row action:
  **"Przypnij do organizacji"** → pick from list or create new → move
  (+ optional team assignment).

---

## 4. Backend changes

1. `POST /auth/register-coach` — workspace + coach user + JWT.
2. `RegisterCoachRequest` schema.
3. `POST /invitations/ghost` — make `team_id` optional; accept
   `organization_id` as the alternative target (individual clients have no
   team). Access check unchanged (`check_org_access`).
4. `POST /api/users/{id}/move-organization` — move a user to another org
   (sets `organization_id`, clears/reassigns team memberships). Guards:
   caller is a coach/admin with access to BOTH source and target org; for
   coaches, source must be their workspace or an accessible org. Designed to
   be reusable for the future self-registration flow.
5. `GET /auth/my-organizations` — for coaches, exclude the home/workspace org
   from the returned list (it must not appear in the client switcher).

Everything else (org creation, teams CRUD, ghost invite with inline talents,
PDF parsing, invitation statuses, resend) is reused as-is.

---

## 5. Out of scope

- Global "Talentpilot" container org for self-registered individuals (separate
  spec; the move-organization endpoint is designed to serve it later).
- Billing / coach verification.
- Separate `/coach/*` console (approach C — rejected as over-engineering).
- Multi-membership (user in many orgs) — rejected; pin = move.
- Rewriting Q&A/Tips engines to multi-subject (UI reframing only).
- Push/real-time notifications.

---

## 6. Testing / acceptance criteria

- `POST /auth/register-coach` creates COACH user + workspace org, returns JWT;
  frontend lands on the coach wizard (cookie `onboarding=1`).
- Superadmin can still create a coach and promote a user to coach (regression).
- Coach's workspace org does NOT appear in the client switcher.
- Coach sidebar hides My Talents and Tips → Mój Ruch; direct navigation to
  `/dashboard/my-talents` as a coach redirects away.
- Wizard: adding client → team → person-with-talents drives progress to 100%
  and the wizard disappears; abandoning mid-way resumes at the right step.
- Individual path: person created in workspace, no team required; profile is
  the landing target.
- "Upload now": PDF → ghost user with talents, NO email sent. "Invite": ghost
  user + email, status "Invited".
- Ghost invite without `team_id` but with `organization_id` works; with
  neither → 422.
- Move: individual client pinned to a client org gets the new
  `organization_id` (+ team if chosen) and disappears from the "Indywidualni"
  tab.
- Privacy: two individual clients of the same coach, both logged in, cannot
  see each other (no shared team in the workspace).
