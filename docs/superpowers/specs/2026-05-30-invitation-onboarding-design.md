# TalentPilot — Invitation & Onboarding Flow Design

**Date:** 2026-05-30  
**Approach:** B — Full flow  
**Scope:** Auto email on invite + status badges + resend + org-level language + onboarding screen

---

## Goal

Replace the manual "copy link" invitation flow with an automated email invitation, add invitation status tracking (Invited/Active/Expired), allow coaches to resend invitations, set email language at the organization level, and show a first-login onboarding screen to newly joined users.

---

## Current State

- `POST /invitations/ghost` creates a ghost user (`is_ghost=True, is_active=False`) with a join token
- `EmailService.send_invitation_email()` exists in `backend/services/email_service.py` but is NOT called from the invite endpoint
- SMTP is configured (Gmail credentials in `.env`)
- Users join via `POST /auth/join/{token}` → `/join?token=...` page
- No invitation status tracking; no resend capability

---

## Data Model

### 1. `organizations.language`

New column: `language VARCHAR(10) NOT NULL DEFAULT 'pl'`

Alembic migration: `l6m7n8o9p0q1_add_language_to_organization.py`

```python
op.add_column('organizations', sa.Column('language', sa.String(10), nullable=False, server_default='pl'))
```

Accepted values: `"pl"`, `"en"`.

### 2. `users.invited_at`

New column: `invited_at TIMESTAMP WITH TIME ZONE NULL`

Alembic migration: `m7n8o9p0q1r2_add_invited_at_to_user.py`

```python
op.add_column('users', sa.Column('invited_at', sa.DateTime(timezone=True), nullable=True))
```

Set when the invitation email is sent; updated on resend (resets the expiry timer).

### 3. Invitation status (computed, not stored)

Computed from existing fields on every response:

```python
def compute_invitation_status(user) -> str:
    if user.is_active:
        return "active"
    if user.invited_at and user.invited_at < datetime.now(timezone.utc) - timedelta(days=7):
        return "expired"
    return "invited"
```

`invited_at` is stored as timezone-aware; use `datetime.now(timezone.utc)` for comparison.

No new DB column needed.

---

## Backend

### 1. Wire email on invite

In the ghost user creation endpoint, after `db.commit()`:

```python
await email_service.send_invitation_email(
    to_email=ghost_user.email,
    invitee_name=ghost_user.name,
    org_name=organization.name,
    join_token=ghost_user.join_token,
    language=organization.language,
)
ghost_user.invited_at = datetime.now(timezone.utc)
db.commit()
```

### 2. Organization language — schema update

`OrganizationUpdate` — add `language: Optional[str] = Field(default=None, pattern=r'^(pl|en)$')`  
`OrganizationResponse` — add `language: str = "pl"`

`PATCH /api/organizations/{id}` already exists — no new endpoint needed.

### 3. Resend endpoint

`POST /api/users/{user_id}/resend-invitation`

- Auth: coach/admin of that organization only
- Guard: `user.is_ghost=True AND user.is_active=False`
- Action: resend email, set `invited_at = datetime.utcnow()`
- Response: `{ "ok": true }`

### 4. Email template — bilingual

`send_invitation_email()` gains a `language: str = "pl"` parameter:

```python
subjects = {
    "pl": f"Zaproszenie do {org_name} na TalentPilot",
    "en": f"You're invited to join {org_name} on TalentPilot",
}
bodies = {
    "pl": f"""Cześć {invitee_name},\n\n{coach_name} zaprasza Cię do zespołu {org_name} na TalentPilot...\n\nDołącz tutaj: {join_url}""",
    "en": f"""Hi {invitee_name},\n\n{coach_name} has invited you to join {org_name} on TalentPilot...\n\nJoin here: {join_url}""",
}
```

### 5. `invitation_status` in user responses

Add computed fields to `UserResponse` and `TeamMemberResponse`:

```python
invitation_status: str = "active"  # "active" | "invited" | "expired"
invited_at: Optional[datetime] = None
```

Both populated in the router: `invitation_status` from `compute_invitation_status(user)`, `invited_at` directly from `user.invited_at`. The frontend uses `invited_at` to display "N days ago" on badge tooltips.

---

## Frontend

### 1. Status badges on team member list

In `app/(dashboard)/dashboard/teams/[id]/page.tsx`, each member row shows a badge based on `invitation_status`:

| Status     | Color  | Label (PL)        | Label (EN)     |
|------------|--------|-------------------|----------------|
| `active`   | green  | Aktywny           | Active         |
| `invited`  | yellow | Zaproszony        | Invited        |
| `expired`  | gray   | Wygasł            | Expired        |

For `invited` and `expired`: show "N dni temu" / "N days ago" based on `invited_at` from API response.

### 2. Resend button

Visible next to ghost users (`invitation_status === 'invited' | 'expired'`).

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={isResending}
  onClick={() => handleResend(member.id)}
>
  {isResending ? t('common.sending') : t('invitations.resend')}
</Button>
```

Calls `POST /api/users/{id}/resend-invitation`, then refreshes the member list. Disabled during request (loading state).

### 3. Organization language in org settings

In `app/(dashboard)/dashboard/organizations/[id]/page.tsx`, new "Język zaproszeń" / "Invitation language" section:

```tsx
<div className="flex gap-2">
  <Button variant={orgLang === 'pl' ? 'default' : 'outline'} onClick={() => handleOrgLangChange('pl')}>
    Polski
  </Button>
  <Button variant={orgLang === 'en' ? 'default' : 'outline'} onClick={() => handleOrgLangChange('en')}>
    English
  </Button>
</div>
```

`handleOrgLangChange`: `PATCH /api/organizations/{id} { language: newLang }`. Visible only to coach/admin.

### 4. Join link as fallback

The existing copy-to-clipboard join link stays in the ghost user creation UI. Email is the primary path; link is the fallback.

### 5. Onboarding screen

New page: `app/(dashboard)/dashboard/onboarding/page.tsx`

**Trigger:** After successful join (`POST /auth/join/{token}`), the join page sets a session cookie `onboarding=1` and redirects to `/dashboard/onboarding` instead of `/dashboard`.

**Content:**

```
Welcome to TalentPilot, [name]!
Your team: [team name]

Here's what to do first:

  1. Upload your Gallup PDF report
     [Go to My Talents →]

  2. See your team's talents
     [Go to Team →]

  3. Ask AI about your talents
     [Go to Q&A →]

  [Get started →]  ← redirects to /dashboard, clears cookie
```

**Guard:** If a user navigates directly to `/dashboard/onboarding` without the `onboarding` cookie → `redirect('/dashboard')`.

**i18n:** Full PL/EN via `useTranslations('onboarding')`.

**Coach notification:** No push. When the coach next opens the team page, the member's badge automatically shows `active` (status computed from `is_active=True`).

---

## Data Flow

```
Coach clicks "Invite" in team view
  → POST /invitations/ghost
  → ghost user created (is_ghost=True, is_active=False, join_token=uuid)
  → email_service.send_invitation_email(language=org.language)
  → user.invited_at = now()
  → team member list shows badge: "Invited"

New user clicks email link → /join?token=...
  → fills in name + password
  → POST /auth/join/{token}
  → is_active=True, is_ghost=False
  → cookie onboarding=1 set
  → redirect /dashboard/onboarding
  → user sees welcome screen with 3 next steps
  → clicks "Get started" → /dashboard

Coach opens team page
  → member now shows badge: "Active"

If 7 days pass with no action:
  → badge shows: "Expired"
  → resend button available → POST /api/users/{id}/resend-invitation
  → invited_at reset to now(), email resent
```

---

## i18n additions

New keys in `messages/pl.json` and `messages/en.json`:

```json
{
  "invitations": {
    "resend": "Wyślij ponownie",
    "status": {
      "active": "Aktywny",
      "invited": "Zaproszony",
      "expired": "Wygasł"
    },
    "invitedAgo": "{{days}} dni temu",
    "orgLanguage": {
      "title": "Język zaproszeń",
      "description": "Język w którym nowi członkowie otrzymają zaproszenie email."
    }
  },
  "onboarding": {
    "title": "Witaj w TalentPilot!",
    "subtitle": "Twój zespół: {{teamName}}",
    "step1": { "title": "Wgraj raport Gallup PDF", "cta": "Przejdź do Moich Talentów" },
    "step2": { "title": "Zobacz talenty zespołu", "cta": "Przejdź do Zespołu" },
    "step3": { "title": "Zapytaj AI o swoje talenty", "cta": "Przejdź do Q&A" },
    "cta": "Zacznij"
  }
}
```

---

## Out of scope

- Push/real-time notifications for coach when member joins
- Invitation expiry hard-delete (ghost user stays in DB, just shows "Expired" badge)
- Email tracking / open rates
- Multiple pending invitations per email address

---

## Testing

- After invite: ghost user has `invited_at` set; email sent to address
- Badge shows "Invited" on team page
- After 7 days (mocked via invited_at backdating): badge shows "Expired", resend button visible
- After resend: `invited_at` reset, email resent, badge returns to "Invited"
- After org language set to EN: next invitation email arrives in English
- After joining: user lands on `/dashboard/onboarding`, not `/dashboard`
- After clicking "Get started": redirect to `/dashboard`, `onboarding` cookie cleared
- Direct navigation to `/dashboard/onboarding` without cookie: redirect to `/dashboard`
- After joining: coach's team page shows member with "Active" badge
