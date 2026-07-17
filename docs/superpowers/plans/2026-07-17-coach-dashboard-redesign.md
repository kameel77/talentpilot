# Coach Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated dashboard for the COACH role (client-centric, no talent-distribution panel) plus a collapsible desktop sidebar (icon rail) for all roles.

**Architecture:** New backend aggregate endpoint `GET /api/dashboard/coach-overview` (mirrors the existing `/api/dashboard/overview` single-call pattern), a new `CoachDashboard` React component rendered from `/dashboard` when the user's role is `coach`, and a collapse toggle added to the existing sidebar in the dashboard layout. Spec: `docs/superpowers/specs/2026-07-17-coach-dashboard-redesign-design.md`.

**Tech Stack:** FastAPI + SQLAlchemy + pytest (backend), Next.js App Router + TypeScript + Tailwind + next-intl + lucide-react (frontend).

## Global Constraints

- Work on branch `feature/coach-dashboard-redesign` (already created; spec committed).
- Code and comments in English; UI copy in both `messages/pl.json` and `messages/en.json`.
- The leader/member (`admin`/`manager`/`user`) dashboard content must not change visually or functionally.
- The coach's workspace organization (`Organization.is_workspace == True`) must NEVER appear as a client anywhere.
- No N+1 query patterns in the new endpoint — grouped aggregates only.
- Backend tests run from `backend/`: `python3 -m pytest tests/ -v` (SQLite in-memory; no live DB needed). One pre-existing failure is known and unrelated: `test_extract_ranked_talents_pl`.
- Frontend check: `npm run build` from `frontend/` (also run `npm run lint`).
- Commit after each task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Backend — `GET /api/dashboard/coach-overview`

**Files:**
- Modify: `backend/schemas.py` (append to the "Dashboard overview" section at the bottom, after `class DashboardOverview`, ~line 800)
- Modify: `backend/routers/dashboard.py`
- Test: `backend/tests/test_coach_dashboard.py` (new file)

**Interfaces:**
- Consumes: existing models `Organization` (`is_workspace`), `OrganizationAccess`, `Team`, `User`, `UserTalent`, `Talent`; existing deps `get_current_user`, `get_db`; existing test fixtures `client`, `db_session`, `auth_headers_admin`, `auth_headers_user` from `backend/tests/conftest.py`.
- Produces: `GET /api/dashboard/coach-overview` returning `CoachDashboardOverview` JSON:
  `{ clients: [{id, name, members, teams, users_with_talents}], individual_clients: int, individual_clients_with_talents: int, totals: {clients, teams, people, users_with_talents} }`. Task 2 consumes this shape verbatim.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_coach_dashboard.py`:

```python
"""Tests for GET /api/dashboard/coach-overview."""
from auth import hash_password
from models import (
    GallupDomain,
    Organization,
    Talent,
    Team,
    User,
    UserRole,
    UserTalent,
)


def _register_coach(client, email="coach@example.com", full_name="Anna Kowalska"):
    """Helper: register a coach via self-serve endpoint, return auth headers."""
    response = client.post(
        "/api/auth/register-coach",
        json={"email": email, "password": "password123", "full_name": full_name},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _add_user(db_session, org_id, email, with_talent=None):
    """Helper: create an active user in org; optionally attach one talent."""
    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name=email.split("@")[0].title(),
        role=UserRole.USER,
        organization_id=org_id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    if with_talent is not None:
        db_session.add(UserTalent(user_id=user.id, talent_id=with_talent.id, rank=1))
        db_session.commit()
    return user


def _make_talent(db_session, code="achiever"):
    talent = Talent(code=code, domain=GallupDomain.EXECUTING)
    db_session.add(talent)
    db_session.commit()
    db_session.refresh(talent)
    return talent


def test_coach_overview_aggregates_clients_and_individuals(client, db_session):
    headers = _register_coach(client)
    talent = _make_talent(db_session)

    # Two client orgs created by the coach (auto-granted OrganizationAccess)
    org_a = client.post("/api/organizations", json={"name": "Acme"}, headers=headers).json()
    org_b = client.post("/api/organizations", json={"name": "Beta"}, headers=headers).json()

    # Acme: 2 members, 1 with talents, 1 team
    _add_user(db_session, org_a["id"], "a1@acme.com", with_talent=talent)
    _add_user(db_session, org_a["id"], "a2@acme.com")
    db_session.add(Team(name="Acme Team", organization_id=org_a["id"]))
    db_session.commit()

    # Beta: 1 member, no talents, no teams
    _add_user(db_session, org_b["id"], "b1@beta.com")

    # One individual client (in the coach's workspace), with talents
    coach = db_session.query(User).filter(User.email == "coach@example.com").first()
    _add_user(db_session, coach.organization_id, "indiv@example.com", with_talent=talent)

    response = client.get("/api/dashboard/coach-overview", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert [c["name"] for c in data["clients"]] == ["Acme", "Beta"]
    acme = data["clients"][0]
    assert acme == {
        "id": org_a["id"], "name": "Acme",
        "members": 2, "teams": 1, "users_with_talents": 1,
    }
    beta = data["clients"][1]
    assert beta["members"] == 1
    assert beta["teams"] == 0
    assert beta["users_with_talents"] == 0

    assert data["individual_clients"] == 1
    assert data["individual_clients_with_talents"] == 1
    assert data["totals"] == {
        "clients": 2, "teams": 1, "people": 4, "users_with_talents": 2,
    }


def test_coach_overview_excludes_workspace_from_clients(client, db_session):
    headers = _register_coach(client, email="w@example.com", full_name="W Coach")
    client.post("/api/organizations", json={"name": "RealClient"}, headers=headers)

    data = client.get("/api/dashboard/coach-overview", headers=headers).json()
    names = [c["name"] for c in data["clients"]]
    assert names == ["RealClient"]
    assert all("Coaching" not in n for n in names)


def test_coach_overview_empty_state(client):
    headers = _register_coach(client, email="e@example.com", full_name="Empty Coach")
    data = client.get("/api/dashboard/coach-overview", headers=headers).json()
    assert data["clients"] == []
    assert data["individual_clients"] == 0
    assert data["totals"] == {"clients": 0, "teams": 0, "people": 0, "users_with_talents": 0}


def test_coach_overview_forbidden_for_non_coach(client, auth_headers_admin, auth_headers_user):
    for headers in (auth_headers_admin, auth_headers_user):
        response = client.get("/api/dashboard/coach-overview", headers=headers)
        assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python3 -m pytest tests/test_coach_dashboard.py -v`
Expected: all 4 tests FAIL with `404` (route not registered yet).

- [ ] **Step 3: Add response schemas**

In `backend/schemas.py`, append after `class DashboardOverview` (end of the "Dashboard overview" section):

```python
class CoachClientOverview(BaseModel):
    """Per-client-organization stats for the coach dashboard."""
    id: int
    name: str
    members: int
    teams: int
    users_with_talents: int


class CoachDashboardTotals(BaseModel):
    """Aggregate totals across client orgs and individual clients."""
    clients: int
    teams: int
    people: int
    users_with_talents: int


class CoachDashboardOverview(BaseModel):
    """Single-call aggregate for the coach dashboard landing page."""
    clients: List[CoachClientOverview]
    individual_clients: int
    individual_clients_with_talents: int
    totals: CoachDashboardTotals
```

- [ ] **Step 4: Implement the endpoint**

In `backend/routers/dashboard.py`:

Update imports at the top:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import (
    GallupDomain,
    Organization,
    OrganizationAccess,
    Talent,
    Team,
    User,
    UserRole,
    UserTalent,
    user_teams,
)
from schemas import (
    CoachClientOverview,
    CoachDashboardOverview,
    CoachDashboardTotals,
    DashboardMember,
    DashboardOverview,
    TeamDomainCounts,
)
from auth import get_current_user, get_current_active_org_id
```

Append the endpoint after `get_dashboard_overview`:

```python
@router.get("/coach-overview", response_model=CoachDashboardOverview)
def get_coach_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate data for the coach dashboard landing page in one call.

    Clients = orgs granted via OrganizationAccess, excluding workspaces.
    Individual clients = users in the coach's own workspace (minus the coach).
    """
    if current_user.role != UserRole.COACH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coach role required",
        )

    access_org_ids = [
        org_id
        for (org_id,) in db.query(OrganizationAccess.organization_id)
        .filter(OrganizationAccess.user_id == current_user.id)
        .all()
    ]

    client_orgs = []
    if access_org_ids:
        client_orgs = (
            db.query(Organization)
            .filter(
                Organization.id.in_(access_org_ids),
                Organization.is_workspace.is_(False),
            )
            .order_by(Organization.name)
            .all()
        )
    client_ids = [org.id for org in client_orgs]

    members_by_org: dict[int, int] = {}
    talents_by_org: dict[int, int] = {}
    teams_by_org: dict[int, int] = {}
    if client_ids:
        for org_id, count in (
            db.query(User.organization_id, func.count(User.id))
            .filter(User.organization_id.in_(client_ids))
            .group_by(User.organization_id)
            .all()
        ):
            members_by_org[org_id] = count
        for org_id, count in (
            db.query(User.organization_id, func.count(func.distinct(UserTalent.user_id)))
            .join(UserTalent, UserTalent.user_id == User.id)
            .filter(User.organization_id.in_(client_ids))
            .group_by(User.organization_id)
            .all()
        ):
            talents_by_org[org_id] = count
        for org_id, count in (
            db.query(Team.organization_id, func.count(Team.id))
            .filter(Team.organization_id.in_(client_ids))
            .group_by(Team.organization_id)
            .all()
        ):
            teams_by_org[org_id] = count

    clients = [
        CoachClientOverview(
            id=org.id,
            name=org.name,
            members=members_by_org.get(org.id, 0),
            teams=teams_by_org.get(org.id, 0),
            users_with_talents=talents_by_org.get(org.id, 0),
        )
        for org in client_orgs
    ]

    individual_clients = 0
    individual_clients_with_talents = 0
    if current_user.organization_id is not None:
        individual_clients = (
            db.query(func.count(User.id))
            .filter(
                User.organization_id == current_user.organization_id,
                User.id != current_user.id,
            )
            .scalar()
            or 0
        )
        individual_clients_with_talents = (
            db.query(func.count(func.distinct(UserTalent.user_id)))
            .join(User, User.id == UserTalent.user_id)
            .filter(
                User.organization_id == current_user.organization_id,
                User.id != current_user.id,
            )
            .scalar()
            or 0
        )

    totals = CoachDashboardTotals(
        clients=len(clients),
        teams=sum(c.teams for c in clients),
        people=sum(c.members for c in clients) + individual_clients,
        users_with_talents=sum(c.users_with_talents for c in clients)
        + individual_clients_with_talents,
    )

    return CoachDashboardOverview(
        clients=clients,
        individual_clients=individual_clients,
        individual_clients_with_talents=individual_clients_with_talents,
        totals=totals,
    )
```

Note: `GallupDomain`, `Talent`, `user_teams`, `TeamDomainCounts`, `DashboardMember`, `DashboardOverview`, `get_current_active_org_id` are used by the existing `get_dashboard_overview` — keep them imported.

- [ ] **Step 5: Run the new tests**

Run: `cd backend && python3 -m pytest tests/test_coach_dashboard.py -v`
Expected: 4 passed.

- [ ] **Step 6: Run the whole backend suite (regression)**

Run: `cd backend && python3 -m pytest tests/ -v`
Expected: everything passes except the known pre-existing `test_extract_ranked_talents_pl` failure.

- [ ] **Step 7: Commit**

```bash
git add backend/schemas.py backend/routers/dashboard.py backend/tests/test_coach_dashboard.py
git commit -m "feat(backend): coach-overview dashboard aggregate endpoint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend API client — types + `coachOverview()`

**Files:**
- Modify: `frontend/lib/api.ts` (interfaces near `DashboardOverview` ~line 398; method in the `dashboard` section of the `api` object ~line 829)

**Interfaces:**
- Consumes: endpoint from Task 1.
- Produces: exported interfaces `CoachClientOverview`, `CoachDashboardTotals`, `CoachDashboardOverview` and `api.dashboard.coachOverview(): Promise<CoachDashboardOverview>`. Task 3 imports all of these from `@/lib/api`.

- [ ] **Step 1: Add interfaces**

In `frontend/lib/api.ts`, directly after `export interface DashboardOverview { ... }`:

```typescript
export interface CoachClientOverview {
    id: number;
    name: string;
    members: number;
    teams: number;
    users_with_talents: number;
}

export interface CoachDashboardTotals {
    clients: number;
    teams: number;
    people: number;
    users_with_talents: number;
}

export interface CoachDashboardOverview {
    clients: CoachClientOverview[];
    individual_clients: number;
    individual_clients_with_talents: number;
    totals: CoachDashboardTotals;
}
```

- [ ] **Step 2: Add the API method**

In the `dashboard` section of the `api` object, after `overview`:

```typescript
        coachOverview: async (): Promise<CoachDashboardOverview> => {
            const response = await apiClient.get<CoachDashboardOverview>('/api/dashboard/coach-overview');
            return response.data;
        },
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run build`
Expected: build succeeds (unused-export warnings are fine; the interfaces are consumed in Task 3).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(frontend): coach-overview API client types and method

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `CoachDashboard` component + role branch on `/dashboard` + i18n

**Files:**
- Create: `frontend/components/dashboard/CoachDashboard.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/page.tsx`
- Modify: `frontend/messages/pl.json` (inside the `"dashboard"` object)
- Modify: `frontend/messages/en.json` (inside the `"dashboard"` object)

**Interfaces:**
- Consumes: `api.dashboard.coachOverview()`, `CoachDashboardOverview`, `CoachClientOverview`, `tokenManager` from `@/lib/api` (Task 2); `KPICard` from `@/components/ui/KPICard`.
- Produces: default export `CoachDashboard` (no props), rendered by `page.tsx` when role is `coach`.

- [ ] **Step 1: Add i18n keys**

In `frontend/messages/pl.json`, add inside the `"dashboard"` object (e.g. after `"roleCoach"`):

```json
"coach": {
    "title": "Panel coacha",
    "subtitle": "Twoi klienci i postęp pracy z talentami.",
    "manageClients": "Zarządzaj klientami",
    "kpiClients": "Klienci",
    "kpiClientsDesc": "{count} klientów indywidualnych",
    "kpiTeams": "Zespoły",
    "kpiTeamsDesc": "we wszystkich organizacjach",
    "kpiPeople": "Osoby objęte",
    "kpiPeopleDesc": "łącznie z klientami indywidualnymi",
    "kpiCoverage": "Pokrycie profilami",
    "kpiCoverageDesc": "{covered} z {total} osób",
    "clientsHeading": "Twoi klienci",
    "membersLabel": "osób",
    "teamsLabel": "zespołów",
    "coverageLabel": "Pokrycie profilami",
    "openClient": "Otwórz",
    "individualClients": "Klienci indywidualni",
    "individualClientsDesc": "{covered} z {count} z profilem talentów",
    "goToList": "Przejdź do listy",
    "emptyTitle": "Nie masz jeszcze klientów",
    "emptyDesc": "Dodaj pierwszą organizację lub klienta indywidualnego, aby zacząć pracę z talentami.",
    "emptyCta": "Rozpocznij onboarding"
}
```

In `frontend/messages/en.json`, same position:

```json
"coach": {
    "title": "Coach dashboard",
    "subtitle": "Your clients and talent-work progress.",
    "manageClients": "Manage clients",
    "kpiClients": "Clients",
    "kpiClientsDesc": "{count} individual clients",
    "kpiTeams": "Teams",
    "kpiTeamsDesc": "across all organizations",
    "kpiPeople": "People covered",
    "kpiPeopleDesc": "including individual clients",
    "kpiCoverage": "Profile coverage",
    "kpiCoverageDesc": "{covered} of {total} people",
    "clientsHeading": "Your clients",
    "membersLabel": "people",
    "teamsLabel": "teams",
    "coverageLabel": "Profile coverage",
    "openClient": "Open",
    "individualClients": "Individual clients",
    "individualClientsDesc": "{covered} of {count} with a talent profile",
    "goToList": "Go to list",
    "emptyTitle": "No clients yet",
    "emptyDesc": "Add your first organization or individual client to start working with talents.",
    "emptyCta": "Start onboarding"
}
```

- [ ] **Step 2: Create `CoachDashboard.tsx`**

Create `frontend/components/dashboard/CoachDashboard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { KPICard } from "@/components/ui/KPICard";
import {
    Briefcase,
    Users,
    UsersRound,
    TrendingUp,
    ArrowRight,
    Sparkles,
    Loader2,
    UserRound,
    Building,
    ChevronRight,
} from "lucide-react";
import { api, tokenManager, CoachDashboardOverview, CoachClientOverview, User } from "@/lib/api";

export default function CoachDashboard() {
    const t = useTranslations("dashboard");
    const tCoach = useTranslations("dashboard.coach");
    const tCommon = useTranslations("common");
    const tOnboarding = useTranslations("onboarding");

    const [data, setData] = useState<CoachDashboardOverview | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setUser(tokenManager.getUser());
        (async () => {
            try {
                setData(await api.dashboard.coachOverview());
            } catch {
                setError(t("loadError"));
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-slate-500">{tCommon("loading")}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-6 text-center">
                    <p className="text-sm font-medium text-rose-700">{error}</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const firstName = user?.full_name?.split(" ")[0];
    const { clients, individual_clients, individual_clients_with_talents, totals } = data;
    const hasAnyClients = clients.length > 0 || individual_clients > 0;
    const coveragePct = totals.people > 0
        ? Math.round((totals.users_with_talents / totals.people) * 100)
        : 0;

    const openClient = (orgId: number) => {
        tokenManager.setActiveOrgId(orgId);
        window.location.assign("/dashboard/teams");
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-slate-900 tracking-tight">
                        {tCoach("title")}
                    </h1>
                    <p className="mt-1 text-slate-500 font-medium">
                        {firstName ? t("greeting", { name: firstName }) : t("greetingFallback")} {tCoach("subtitle")}
                    </p>
                </div>
                <Link
                    href="/dashboard/organizations"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all group"
                >
                    {tCoach("manageClients")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Onboarding banner — coach with no clients at all */}
            {!hasAnyClients && (
                <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4">
                    <p className="text-sm font-medium text-blue-800">{tOnboarding("coach.resumeBanner")}</p>
                    <Link href="/dashboard/onboarding" className="text-sm font-bold text-blue-700 hover:underline">
                        {tOnboarding("coach.resumeCta")} →
                    </Link>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <KPICard
                    title={tCoach("kpiClients")}
                    value={totals.clients}
                    icon={<Briefcase className="h-5 w-5" />}
                    description={tCoach("kpiClientsDesc", { count: individual_clients })}
                />
                <KPICard
                    title={tCoach("kpiTeams")}
                    value={totals.teams}
                    icon={<Users className="h-5 w-5" />}
                    description={tCoach("kpiTeamsDesc")}
                />
                <KPICard
                    title={tCoach("kpiPeople")}
                    value={totals.people}
                    icon={<UsersRound className="h-5 w-5" />}
                    description={tCoach("kpiPeopleDesc")}
                />
                <KPICard
                    title={tCoach("kpiCoverage")}
                    value={`${coveragePct}%`}
                    icon={<TrendingUp className="h-5 w-5" />}
                    description={tCoach("kpiCoverageDesc", {
                        covered: totals.users_with_talents,
                        total: totals.people,
                    })}
                />
            </div>

            {/* Clients */}
            <div className="space-y-6">
                <h3 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">
                    {tCoach("clientsHeading")}
                </h3>

                {!hasAnyClients ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 sm:p-16 text-center">
                        <Building className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-slate-700">{tCoach("emptyTitle")}</h4>
                        <p className="mt-2 text-sm text-slate-500">{tCoach("emptyDesc")}</p>
                        <Link
                            href="/dashboard/onboarding"
                            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm"
                        >
                            {tCoach("emptyCta")}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {clients.map((client) => (
                            <ClientCard
                                key={client.id}
                                client={client}
                                membersLabel={tCoach("membersLabel")}
                                teamsLabel={tCoach("teamsLabel")}
                                coverageLabel={tCoach("coverageLabel")}
                                openLabel={tCoach("openClient")}
                                onOpen={() => openClient(client.id)}
                            />
                        ))}
                        {individual_clients > 0 && (
                            <Link
                                href="/dashboard/organizations"
                                className="group bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <UserRound className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                            {tCoach("individualClients")}
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">
                                            {tCoach("individualClientsDesc", {
                                                covered: individual_clients_with_talents,
                                                count: individual_clients,
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-auto flex items-center justify-between">
                                    <span className="text-3xl font-bold text-slate-900">{individual_clients}</span>
                                    <span className="text-xs font-semibold text-primary flex items-center gap-1">
                                        {tCoach("goToList")}
                                        <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* Q&A Copilot */}
            <div className="bg-blue-50/50 rounded-3xl border border-blue-100/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm ring-1 ring-blue-100 shrink-0">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                        Q&amp;A Copilot
                    </span>
                    <h4 className="text-xl font-bold text-slate-900 font-heading tracking-tight">
                        {t("askAboutTeam")}
                    </h4>
                    <p className="mt-1 text-slate-600">{t("aiCopilotHint")}</p>
                </div>
                <Link
                    href="/dashboard/qa"
                    className="flex items-center gap-2 text-sm font-bold text-slate-900 hover:gap-3 transition-all shrink-0"
                >
                    {t("openQA")}
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}

function ClientCard({
    client,
    membersLabel,
    teamsLabel,
    coverageLabel,
    openLabel,
    onOpen,
}: {
    client: CoachClientOverview;
    membersLabel: string;
    teamsLabel: string;
    coverageLabel: string;
    openLabel: string;
    onOpen: () => void;
}) {
    const coverage = client.members > 0
        ? Math.round((client.users_with_talents / client.members) * 100)
        : 0;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group text-left bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
            <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center shrink-0">
                    <Building className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                        {client.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                        {client.members} {membersLabel} · {client.teams} {teamsLabel}
                    </p>
                </div>
            </div>

            <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-500">{coverageLabel}</span>
                    <span className="font-bold text-slate-700">{coverage}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${coverage}%` }}
                    />
                </div>
            </div>

            <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {openLabel}
                <ChevronRight className="h-3 w-3" />
            </span>
        </button>
    );
}
```

- [ ] **Step 3: Branch by role in `page.tsx`**

In `frontend/app/(dashboard)/dashboard/page.tsx`:

1. Add import: `import CoachDashboard from "@/components/dashboard/CoachDashboard";`
2. Rename the existing `export default function DashboardPage()` to `function TeamDashboard()` (drop `export default`).
3. Remove the coach-only onboarding-banner logic from `TeamDashboard` — that is: the `showCoachOnboardingBanner` state, the entire second `useEffect` (the one gated on `me.role !== "coach"`), the `{showCoachOnboardingBanner && (...)}` JSX block, and the now-unused `tOnboarding` variable. Everything else in `TeamDashboard` stays byte-identical.
4. Add the new default export above `TeamDashboard`:

```tsx
export default function DashboardPage() {
    const [role, setRole] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    // Role comes from localStorage — read after mount to avoid hydration mismatch.
    useEffect(() => {
        setRole(tokenManager.getUser()?.role ?? null);
        setReady(true);
    }, []);

    if (!ready) return null;
    if (role === "coach") return <CoachDashboard />;
    return <TeamDashboard />;
}
```

- [ ] **Step 4: Build and lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build succeeds, no new lint errors (in particular no unused-variable errors left over from removing the banner logic).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/CoachDashboard.tsx "frontend/app/(dashboard)/dashboard/page.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): dedicated coach dashboard without talent distribution

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Collapsible desktop sidebar

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx`
- Modify: `frontend/messages/pl.json` (inside the `"nav"` object)
- Modify: `frontend/messages/en.json` (inside the `"nav"` object)

**Interfaces:**
- Consumes: nothing from other tasks (independent of Tasks 1–3).
- Produces: sidebar collapse toggle persisted under localStorage key `tp_sidebar_collapsed` (`"1"` = collapsed). Desktop only; mobile slide-in unchanged.

- [ ] **Step 1: Add i18n keys**

In `frontend/messages/pl.json`, inside `"nav"` (e.g. after `"openMenu"`):

```json
"collapseMenu": "Zwiń menu",
"expandMenu": "Rozwiń menu",
```

In `frontend/messages/en.json`, same position:

```json
"collapseMenu": "Collapse menu",
"expandMenu": "Expand menu",
```

- [ ] **Step 2: Add collapse state to `layout.tsx`**

1. Extend the lucide import with `PanelLeftClose, PanelLeftOpen`.
2. Next to the existing `sidebarOpen` state add:

```tsx
    const [collapsed, setCollapsed] = useState(false);

    // Restore persisted collapse state after mount (avoids SSR hydration mismatch)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(localStorage.getItem("tp_sidebar_collapsed") === "1");
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            localStorage.setItem("tp_sidebar_collapsed", prev ? "0" : "1");
            return !prev;
        });
    };
```

- [ ] **Step 3: Make the `<aside>` width collapsible**

Replace the current `<aside>` (which uses `style={{ width: '256px', backgroundColor: '#111827', minWidth: '256px' }}`) with:

```tsx
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 transition-[transform,width] duration-300 ease-in-out lg:static lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    collapsed ? "lg:w-[72px]" : "lg:w-64"
                )}
                style={{ backgroundColor: '#111827' }}
            >
                {sidebarContent}
            </aside>
```

(Width moves from inline style to classes so it can respond to `collapsed`; mobile keeps `w-64` + translate behavior.)

- [ ] **Step 4: Adapt `sidebarContent` to collapsed mode**

All changes below apply inside the `sidebarContent` JSX. The `collapsed` classes use the `lg:` prefix so mobile (full-width slide-in) is unaffected.

1. **Logo header** — hide the wordmark and center the mark when collapsed:

```tsx
            <div className={cn("p-5 flex items-center justify-between border-b border-white/5 h-16", collapsed && "lg:justify-center lg:p-3")}>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-600 flex items-center justify-center rounded-xl text-white font-bold text-xl">
                        TP
                    </div>
                    <span className={cn("text-xl font-bold text-white tracking-tight", collapsed && "lg:hidden")}>
                        TalentPilot
                    </span>
                </div>
```

(The mobile close button that follows stays unchanged.)

2. **Main nav links** — add `title` and hide labels. In the `navigation.map` link:

```tsx
                            <Link
                                key={item.name}
                                href={item.href}
                                title={item.name}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                    collapsed && "lg:justify-center lg:px-0",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "h-5 w-5 shrink-0",
                                    isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                                )} />
                                <span className={cn(collapsed && "lg:hidden")}>{item.name}</span>
                            </Link>
```

3. **"Administration" section header** — hide when collapsed:

```tsx
                        <h3 className={cn("px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2", collapsed && "lg:hidden")}>
                            {t('administration')}
                        </h3>
```

4. **Admin knowledge link (admin only)** — same treatment as main nav links: add `title={t("adminKnowledge")}`, add `collapsed && "lg:justify-center lg:px-0"` to the link's `cn(...)`, add `shrink-0` to the `Database` icon class, and wrap the label: `<span className={cn(collapsed && "lg:hidden")}>{t("adminKnowledge")}</span>`.

5. **Knowledge sub-links container** — hide the whole `ml-8` div when collapsed:

```tsx
                                    <div className={cn("ml-8 space-y-1", collapsed && "lg:hidden")}>
```

6. **`adminNavigation.map` links** — same treatment as main nav links: `title={item.name}`, `collapsed && "lg:justify-center lg:px-0"` in `cn(...)`, `shrink-0` on the icon, label wrapped in `<span className={cn(collapsed && "lg:hidden")}>{item.name}</span>`.

7. **Toggle button** — after the closing `</nav>` tag (replacing the `{/* Settings/Logout moved to user dropdown */}` comment position; keep the comment), add:

```tsx
            {/* Collapse toggle — desktop only */}
            <div className="hidden lg:block p-3 border-t border-white/5">
                <button
                    onClick={toggleCollapsed}
                    title={collapsed ? t('expandMenu') : t('collapseMenu')}
                    aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
                        collapsed && "justify-center px-0"
                    )}
                >
                    {collapsed ? (
                        <PanelLeftOpen className="h-5 w-5 shrink-0" />
                    ) : (
                        <>
                            <PanelLeftClose className="h-5 w-5 shrink-0" />
                            {t('collapseMenu')}
                        </>
                    )}
                </button>
            </div>
```

- [ ] **Step 5: Build and lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build succeeds, no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add "frontend/app/(dashboard)/layout.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): collapsible desktop sidebar (icon rail)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Full verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: green build + test evidence for the final report.

- [ ] **Step 1: Backend suite**

Run: `cd backend && python3 -m pytest tests/ -v`
Expected: all pass except the known pre-existing `test_extract_ranked_talents_pl` failure. Report the exact pass/fail counts.

- [ ] **Step 2: Frontend build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: success. Report any warnings.

- [ ] **Step 3: Working tree check**

Run: `git status && git log --oneline main..HEAD`
Expected: clean tree; commits for spec, plan, Tasks 1–4.
