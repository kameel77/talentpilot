# Matrix Density, Full-Width Layout & Talent Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-width dashboard layout, a compact team talent matrix that fits one desktop screen, hover tooltips with talent descriptions, and an admin CMS to manage talent names/descriptions per language.

**Architecture:** Frontend-only changes for layout/matrix/tooltip (data already flows from `GET /api/talents`). New admin endpoints (`GET /api/admin/talents`, `PATCH /api/admin/talents/{id}/translations/{language}`) + a new admin page. PL short descriptions added to the seed script and an idempotent backfill script for existing databases.

**Tech Stack:** FastAPI + SQLAlchemy + pytest (backend), Next.js + TypeScript + Tailwind + next-intl (frontend).

**Spec:** `docs/superpowers/specs/2026-07-17-matrix-density-tooltips-design.md`

## Global Constraints

- Branch: `feature/matrix-density-tooltips` (already checked out).
- Code and comments in English; UI copy in both PL and EN via `messages/pl.json` / `messages/en.json`.
- Backend tests: run with `cd backend && python -m pytest tests/ -v` (SQLite in-memory; fixtures in `backend/tests/conftest.py`: `client`, `db_session`, `auth_headers_user`, `auth_headers_admin`).
- Match existing code style (4-space TSX indentation, existing router/schema conventions).
- Do NOT touch `frontend/components/PresentationContent.tsx`.
- Known pre-existing failing test: `test_parse_pdf_unauthorized` (returns 403 instead of 401) — not yours to fix.

---

### Task 1: Admin talents API (backend)

**Files:**
- Modify: `backend/schemas.py` (add schemas near `TalentTranslationResponse`, ~line 229)
- Modify: `backend/routers/admin.py` (new section + imports)
- Test: `backend/tests/test_admin_talents.py` (new)

**Interfaces:**
- Produces: `GET /api/admin/talents` → `list[AdminTalentResponse]` where each item is `{id, code, domain, translations: [{language, name, short_description, description}]}`. `PATCH /api/admin/talents/{talent_id}/translations/{language}` with body `{name?, short_description?, description?}` → single `TalentTranslationResponse`. Admin-only (`require_role(["admin"])`). Frontend Task 6 consumes these exact shapes.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_admin_talents.py`:

```python
"""Tests for admin talent content management endpoints."""
import pytest

from models import Talent, TalentTranslation, GallupDomain


@pytest.fixture
def seeded_talents(db_session):
    """Create two talents with EN translations (and one PL name-only)."""
    achiever = Talent(code="achiever", domain=GallupDomain.EXECUTING)
    strategic = Talent(code="strategic", domain=GallupDomain.STRATEGIC_THINKING)
    db_session.add_all([achiever, strategic])
    db_session.flush()
    db_session.add_all([
        TalentTranslation(
            talent_id=achiever.id, language="en", name="Achiever",
            short_description="Great stamina and work ethic",
            description="Full EN description.",
        ),
        TalentTranslation(talent_id=achiever.id, language="pl", name="Osiąganie"),
        TalentTranslation(
            talent_id=strategic.id, language="en", name="Strategic",
            short_description="Creates alternative ways to proceed",
            description="Full EN description.",
        ),
    ])
    db_session.commit()
    return {"achiever": achiever, "strategic": strategic}


class TestListAdminTalents:
    def test_requires_admin(self, client, auth_headers_user, seeded_talents):
        resp = client.get("/api/admin/talents", headers=auth_headers_user)
        assert resp.status_code == 403

    def test_lists_talents_with_all_translations(self, client, auth_headers_admin, seeded_talents):
        resp = client.get("/api/admin/talents", headers=auth_headers_admin)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        achiever = next(t for t in data if t["code"] == "achiever")
        assert achiever["domain"] == "executing"
        langs = {tr["language"] for tr in achiever["translations"]}
        assert langs == {"en", "pl"}
        en = next(tr for tr in achiever["translations"] if tr["language"] == "en")
        assert en["short_description"] == "Great stamina and work ethic"


class TestPatchTalentTranslation:
    def test_requires_admin(self, client, auth_headers_user, seeded_talents):
        resp = client.patch(
            f"/api/admin/talents/{seeded_talents['achiever'].id}/translations/pl",
            headers=auth_headers_user,
            json={"short_description": "x"},
        )
        assert resp.status_code == 403

    def test_partial_update(self, client, auth_headers_admin, seeded_talents, db_session):
        talent_id = seeded_talents["achiever"].id
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"short_description": "Ogromna wytrwałość"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["language"] == "pl"
        assert body["name"] == "Osiąganie"  # untouched
        assert body["short_description"] == "Ogromna wytrwałość"

    def test_update_name_and_description(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["achiever"].id
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/en",
            headers=auth_headers_admin,
            json={"name": "Achiever!", "description": "New full description."},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Achiever!"
        assert resp.json()["description"] == "New full description."

    def test_creates_missing_translation_row(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["strategic"].id  # has no PL row
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"name": "Strateg", "short_description": "Dostrzega wzorce"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Strateg"

    def test_creating_translation_without_name_fails(self, client, auth_headers_admin, seeded_talents):
        talent_id = seeded_talents["strategic"].id  # has no PL row
        resp = client.patch(
            f"/api/admin/talents/{talent_id}/translations/pl",
            headers=auth_headers_admin,
            json={"short_description": "bez nazwy"},
        )
        assert resp.status_code == 422

    def test_unknown_talent_404(self, client, auth_headers_admin, seeded_talents):
        resp = client.patch(
            "/api/admin/talents/99999/translations/pl",
            headers=auth_headers_admin,
            json={"name": "X"},
        )
        assert resp.status_code == 404
```

Check `models.py` for the exact `GallupDomain` enum member names before running (e.g. `GallupDomain.EXECUTING` vs `GallupDomain.executing`) and adjust the fixture if needed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_admin_talents.py -v`
Expected: FAIL — 404s (endpoints don't exist).

- [ ] **Step 3: Add schemas**

In `backend/schemas.py`, directly after `TalentResponse` (~line 245), add:

```python
class AdminTalentResponse(BaseModel):
    id: int
    code: str
    domain: GallupDomain
    translations: list[TalentTranslationResponse]

    model_config = {"from_attributes": True}


class AdminTalentTranslationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    short_description: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
```

- [ ] **Step 4: Add endpoints**

In `backend/routers/admin.py`: extend the `models` import with `Talent, TalentTranslation`, extend the `schemas` import with `AdminTalentResponse, AdminTalentTranslationUpdate, TalentTranslationResponse`, then add a new section (e.g. after the organization endpoints, before the knowledge section):

```python
# -------- Talent Content Management --------

@router.get("/talents", response_model=list[AdminTalentResponse])
def list_talents_admin(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """List all talents with translations in every language (admin CMS)."""
    return db.query(Talent).order_by(Talent.id).all()


@router.patch(
    "/talents/{talent_id}/translations/{language}",
    response_model=TalentTranslationResponse,
)
def update_talent_translation(
    talent_id: int,
    language: str,
    payload: AdminTalentTranslationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    """Update (or create) a talent translation for the given language."""
    talent = db.query(Talent).filter(Talent.id == talent_id).first()
    if not talent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Talent not found")

    translation = (
        db.query(TalentTranslation)
        .filter(
            TalentTranslation.talent_id == talent_id,
            TalentTranslation.language == language,
        )
        .first()
    )
    if not translation:
        if not payload.name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="name is required when creating a new translation",
            )
        translation = TalentTranslation(talent_id=talent_id, language=language)
        db.add(translation)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(translation, field, value)

    db.commit()
    db.refresh(translation)
    return translation
```

Note: `AdminTalentResponse.translations` serializes via the existing `Talent.translations` relationship.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_admin_talents.py -v`
Expected: all PASS. Then run the full suite: `python -m pytest tests/ -v` — no new failures (ignore pre-existing `test_parse_pdf_unauthorized`).

- [ ] **Step 6: Commit**

```bash
git add backend/schemas.py backend/routers/admin.py backend/tests/test_admin_talents.py
git commit -m "feat(backend): admin endpoints for talent translation management"
```

---

### Task 2: PL short descriptions — seed + backfill script

**Files:**
- Modify: `backend/scripts/seed_talents.py`
- Create: `backend/scripts/backfill_talent_descriptions.py`

**Interfaces:**
- Produces: `PL_TALENT_SHORT_DESCRIPTIONS: dict[str, str]` in `seed_talents.py` (code → PL short description), imported by the backfill script. Fresh seeds get PL `short_description`; backfill upserts it into existing DBs without overwriting non-empty values.

- [ ] **Step 1: Add PL short descriptions to the seed script**

In `backend/scripts/seed_talents.py`, next to the existing `PL_TALENT_NAMES` dict, add:

```python
# Polish short descriptions (authored from official Gallup theme descriptions)
PL_TALENT_SHORT_DESCRIPTIONS = {
    "achiever": "Ogromna wytrwałość i satysfakcja z bycia produktywnym",
    "arranger": "Elastyczne organizowanie ludzi i zasobów dla maksymalnej produktywności",
    "belief": "Trwałe wartości, które nadają życiu sens i kierunek",
    "consistency": "Równe traktowanie wszystkich według jasnych zasad",
    "deliberative": "Ostrożność w decyzjach i staranne przewidywanie przeszkód",
    "discipline": "Potrzeba rutyny, struktury i uporządkowanego świata",
    "focus": "Wyznaczanie kierunku i konsekwentne dążenie do celu",
    "responsibility": "Poczucie własności zobowiązań i dotrzymywanie słowa",
    "restorative": "Biegłość w diagnozowaniu i rozwiązywaniu problemów",
    "activator": "Zamienianie myśli w działanie — od razu",
    "command": "Silna obecność, przejmowanie kontroli i wyrażanie zdania wprost",
    "communication": "Łatwość ubierania myśli w słowa w rozmowie i prezentacji",
    "competition": "Mierzenie postępów na tle innych i dążenie do zwycięstwa",
    "maximizer": "Przekształcanie mocnych stron w doskonałość",
    "self-assurance": "Wewnętrzna pewność własnych osądów i możliwości",
    "significance": "Pragnienie dużego wpływu i bycia docenianym",
    "woo": "Radość ze zdobywania sympatii nowo poznanych osób",
    "adaptability": "Życie chwilą i spokojne przyjmowanie zmian",
    "connectedness": "Wiara, że wszystko jest ze sobą powiązane i ma sens",
    "developer": "Dostrzeganie i pielęgnowanie potencjału innych",
    "empathy": "Wyczuwanie emocji innych i patrzenie na świat ich oczami",
    "harmony": "Poszukiwanie zgody i unikanie konfliktów",
    "includer": "Poszerzanie kręgu i włączanie tych, którzy stoją z boku",
    "individualization": "Dostrzeganie wyjątkowych cech każdej osoby",
    "positivity": "Zaraźliwy entuzjazm i dostrzeganie dobrych stron",
    "relator": "Głębokie, autentyczne relacje z bliskimi ludźmi",
    "analytical": "Poszukiwanie przyczyn, dowodów i danych",
    "context": "Rozumienie teraźniejszości przez pryzmat przeszłości",
    "futuristic": "Inspirowanie siebie i innych wizją przyszłości",
    "ideation": "Fascynacja pomysłami i łączenie odległych zjawisk",
    "input": "Kolekcjonowanie informacji, rzeczy i pomysłów",
    "intellection": "Potrzeba aktywności intelektualnej i refleksji",
    "learner": "Radość z samego procesu uczenia się i rozwoju",
    "strategic": "Szybkie dostrzeganie wzorców i alternatywnych dróg",
}
```

Then in `seed_talents()`, change the PL translation creation to include it:

```python
        db.add(
            TalentTranslation(
                talent_id=talent.id,
                language="pl",
                name=PL_TALENT_NAMES.get(talent_data["code"], talent_data["name"]),
                short_description=PL_TALENT_SHORT_DESCRIPTIONS.get(talent_data["code"]),
            )
        )
```

- [ ] **Step 2: Create the backfill script**

Create `backend/scripts/backfill_talent_descriptions.py`:

```python
"""Backfill Polish short descriptions for talents in an existing database.

Idempotent: only fills empty short_description fields on PL translations.
Never overwrites values already set (e.g. edited by an admin in the CMS).

Usage: python scripts/backfill_talent_descriptions.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Talent, TalentTranslation
from scripts.seed_talents import PL_TALENT_SHORT_DESCRIPTIONS


def backfill(db: Session) -> None:
    updated = 0
    skipped = 0
    for talent in db.query(Talent).all():
        short_desc = PL_TALENT_SHORT_DESCRIPTIONS.get(talent.code)
        if not short_desc:
            continue
        translation = (
            db.query(TalentTranslation)
            .filter(
                TalentTranslation.talent_id == talent.id,
                TalentTranslation.language == "pl",
            )
            .first()
        )
        if translation is None:
            print(f"⚠️  {talent.code}: no PL translation row, skipping")
            skipped += 1
            continue
        if translation.short_description:
            skipped += 1
            continue
        translation.short_description = short_desc
        updated += 1
    db.commit()
    print(f"✅ Updated {updated} PL short descriptions, skipped {skipped}.")


def main() -> None:
    db = SessionLocal()
    try:
        backfill(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

Before writing, check how the existing `seed_talents.py` builds its DB session/imports (`main()` at the bottom of the file) and mirror that convention exactly (import paths, `SessionLocal` location).

- [ ] **Step 3: Verify the scripts run against the local dev DB**

Run: `cd backend && python scripts/backfill_talent_descriptions.py` (local dev database from `.env`; see memory `local_dev_stack` — backend runs on port 8001).
Expected: `✅ Updated 34 PL short descriptions, skipped 0.` Re-run → `Updated 0, skipped 34` (idempotent).
Then verify via API: `curl -s "http://localhost:8001/api/talents?language=pl" | python3 -m json.tool | head -30` shows PL `short_description`. (If the backend isn't running, verify with a quick one-off Python session instead.)

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_talents.py backend/scripts/backfill_talent_descriptions.py
git commit -m "feat(backend): seed and backfill Polish talent short descriptions"
```

---

### Task 3: Full-width layout + local page width caps

**Files:**
- Modify: `frontend/app/(dashboard)/layout.tsx:476-478`
- Modify: `frontend/app/(dashboard)/dashboard/qa/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/tips/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/settings/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/my-talents/page.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/admin/settings/page.tsx`

**Interfaces:**
- Produces: main content area is full-width with `p-4 sm:p-5 lg:p-6` padding; the five reading/form pages wrap their own content in `max-w-5xl mx-auto w-full` (or `max-w-4xl` where it looks better).

- [ ] **Step 1: Make the main wrapper full-width**

In `frontend/app/(dashboard)/layout.tsx` the current code is:

```tsx
<main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-slate-50">
    <div className="max-w-7xl mx-auto w-full">
        {children}
    </div>
</main>
```

Replace with:

```tsx
<main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6 bg-slate-50">
    {children}
</main>
```

- [ ] **Step 2: Add local width caps to reading/form pages**

For each of the five pages listed above, wrap the page's top-level returned content in a centered cap. Pattern — if the page returns `<div className="space-y-6">…</div>`, change to `<div className="max-w-5xl mx-auto w-full space-y-6">…</div>` (add classes to the existing root element rather than nesting a new div where possible). Use `max-w-5xl` as default; `max-w-4xl` is acceptable for narrow form pages (`admin/settings`) if it looks better in verification.

- [ ] **Step 3: Build check**

Run: `cd frontend && npx next build 2>&1 | tail -20` (or `npm run build`)
Expected: build succeeds, no type errors.

- [ ] **Step 4: Visual spot-check**

Start the dev stack (see `.claude/launch.json` / memory `local_dev_stack`: backend on :8001, frontend dev server) and open the dashboard home, a team page, and each of the five capped pages. Verify: full-width tables, centered reading pages, no horizontal page scroll, sane look with sidebar collapsed and expanded.

- [ ] **Step 5: Commit**

```bash
git add "frontend/app/(dashboard)/layout.tsx" "frontend/app/(dashboard)/dashboard/qa/page.tsx" "frontend/app/(dashboard)/dashboard/tips/page.tsx" "frontend/app/(dashboard)/dashboard/settings/page.tsx" "frontend/app/(dashboard)/dashboard/my-talents/page.tsx" "frontend/app/(dashboard)/dashboard/admin/settings/page.tsx"
git commit -m "feat(frontend): full-width dashboard layout with local width caps on reading pages"
```

---

### Task 4: Compact matrix

**Files:**
- Modify: `frontend/components/dashboard/MatrixDashboard.tsx` (matrix tab table, lines ~168-288)

**Interfaces:**
- Consumes: nothing new. Produces: matrix table ≤ ~1350 px total width; all cell styling changes listed below.

- [ ] **Step 1: Compact the header row**

In the `thead`:
- Name column `th`: `min-w-[200px]` → `min-w-[160px]`, `px-4 py-3` → `px-3 py-2`.
- Talent header `th`s: className `px-2 py-4` → `px-1 py-3`, and in the inline style object: `minWidth: '40px'` → `'32px'`, add `fontSize: '11px'`.

- [ ] **Step 2: Compact member rows**

- Name `td`: `px-4 py-3` → `px-3 py-2`.
- Talent `td`s: `px-1 py-2` → `px-0.5 py-1`.
- Rank badge div: `w-8 h-8 rounded-md text-xs` → `w-7 h-7 rounded-md text-[11px]`.

- [ ] **Step 3: Compact the "Team ranking" and "In TOP 15" rows**

Apply identical changes in both summary rows: name `td` `px-4 py-3` → `px-3 py-2`, talent `td`s `px-1 py-2` → `px-0.5 py-1`, badges `w-8 h-8 … text-xs` → `w-7 h-7 … text-[11px]`.

- [ ] **Step 4: Verify in browser**

With the dev stack running, open a team with 5+ members at a 1440 px viewport with the sidebar collapsed. Expected: entire 34-column matrix visible without horizontal scroll; numbers legible; domain colors intact. Narrow the viewport below ~1350 px: horizontal scroll appears (fallback works, sticky name column still sticks).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/MatrixDashboard.tsx
git commit -m "feat(frontend): compact team matrix cells to fit one desktop screen"
```

---

### Task 5: Talent tooltip in the matrix header

**Files:**
- Modify: `frontend/components/dashboard/MatrixDashboard.tsx`
- Modify: `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx:521` (pass prop)

**Interfaces:**
- Consumes: `Talent` type from `@/lib/api` (`{id, code, domain, translation: {language, name, description?, short_description?}}`); `allTalents` state already loaded on the team page.
- Produces: `MatrixDashboardProps` gains optional `talents?: Talent[]`.

- [ ] **Step 1: Pass the data down**

In `frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx` change:

```tsx
<MatrixDashboard members={members} canSeeRisks={canSeeRisks} />
```

to:

```tsx
<MatrixDashboard members={members} canSeeRisks={canSeeRisks} talents={allTalents} />
```

- [ ] **Step 2: Add tooltip state and lookup in MatrixDashboard**

In `MatrixDashboard.tsx`:

```tsx
import { Talent } from '@/lib/api';

interface MatrixDashboardProps {
    members: Member[];
    canSeeRisks?: boolean;
    talents?: Talent[];
}
```

Inside the component:

```tsx
const talentInfoByCode = new Map((talents ?? []).map(t => [t.code, t]));
const [headerTooltip, setHeaderTooltip] = useState<{
    code: string;
    x: number;
    y: number;
} | null>(null);
```

- [ ] **Step 3: Wire hover handlers on the talent header cells**

On each talent `th` (the vertical headers) add:

```tsx
onMouseEnter={e => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHeaderTooltip({ code: talent.code, x: rect.left + rect.width / 2, y: rect.bottom });
}}
onMouseLeave={() => setHeaderTooltip(null)}
```

Also add `cursor-help` to the `th` className.

- [ ] **Step 4: Render the tooltip (fixed-position, so `overflow-x-auto` cannot clip it)**

Just inside the matrix tab's outer `<div className="bg-white rounded-2xl …">`, render:

```tsx
{headerTooltip && (() => {
    const info = talentInfoByCode.get(headerTooltip.code);
    const local = GALLUP_TALENTS.find(t => t.code === headerTooltip.code);
    if (!local) return null;
    const name = info?.translation?.name ?? (locale === 'en' ? local.en : local.pl);
    const shortDesc = info?.translation?.short_description;
    const domainColor = getDomainStyle(local.domain);
    const domainLabel = locale === 'en' ? DOMAIN_LABELS[local.domain]?.en : DOMAIN_LABELS[local.domain]?.pl;
    return (
        <div
            className="fixed z-50 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg pointer-events-none"
            style={{ left: headerTooltip.x, top: headerTooltip.y + 8 }}
        >
            <div className="font-semibold text-sm text-slate-900">{name}</div>
            <div className="text-xs font-medium mb-1" style={{ color: domainColor }}>{domainLabel}</div>
            {shortDesc && <div className="text-xs text-slate-600 leading-relaxed">{shortDesc}</div>}
        </div>
    );
})()}
```

Note the fallback chain: backend translation for the user's locale (the API already falls back to EN server-side); if the backend data is absent entirely (`talents` prop not passed), only name + domain show.

- [ ] **Step 5: Verify in browser**

Dev stack running, PL descriptions backfilled (Task 2). Hover several talent headers on a team page. Expected: tooltip under the header with PL name, colored domain label, and PL short description; no clipping at the left/right edges of the matrix; tooltip disappears on mouse leave. Switch account language to EN (or check an EN user) → EN texts.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/dashboard/MatrixDashboard.tsx "frontend/app/(dashboard)/dashboard/teams/[id]/page.tsx"
git commit -m "feat(frontend): talent description tooltips in team matrix header"
```

---

### Task 6: Admin CMS page for talent content

**Files:**
- Modify: `frontend/lib/api.ts` (types + `admin` section, ~line 699)
- Create: `frontend/app/(dashboard)/dashboard/admin/talents/page.tsx`
- Modify: `frontend/app/(dashboard)/layout.tsx` (`adminNavigation`, ~line 156)
- Modify: `frontend/messages/pl.json`, `frontend/messages/en.json`

**Interfaces:**
- Consumes: Task 1 endpoints. Produces: `api.admin.listTalents(): Promise<AdminTalent[]>` and `api.admin.updateTalentTranslation(talentId, language, data): Promise<TalentTranslation>` where `AdminTalent = {id, code, domain, translations: TalentTranslation[]}`.

- [ ] **Step 1: API client**

In `frontend/lib/api.ts`, near the existing `Talent` interface add:

```ts
export interface AdminTalent {
    id: number;
    code: string;
    domain: 'executing' | 'influencing' | 'relationship_building' | 'strategic_thinking';
    translations: TalentTranslation[];
}
```

In the `admin` section add:

```ts
listTalents: async (): Promise<AdminTalent[]> => {
    const response = await apiClient.get<AdminTalent[]>('/api/admin/talents');
    return response.data;
},
updateTalentTranslation: async (
    talentId: number,
    language: string,
    data: { name?: string; short_description?: string; description?: string },
): Promise<TalentTranslation> => {
    const response = await apiClient.patch<TalentTranslation>(
        `/api/admin/talents/${talentId}/translations/${language}`,
        data,
    );
    return response.data;
},
```

(Match the surrounding style; check whether `TalentTranslation` is exported and export it if not.)

- [ ] **Step 2: i18n messages**

Read the structure of `frontend/messages/pl.json` first (namespaces + how the admin pages name their keys). Add a new `adminTalents` namespace with keys (PL / EN):

- `title`: "Talenty — treści" / "Talent content"
- `subtitle`: "Zarządzaj nazwami i opisami 34 talentów Gallupa" / "Manage names and descriptions of the 34 Gallup talents"
- `edit`: "Edytuj" / "Edit"
- `name`: "Nazwa" / "Name"
- `shortDescription`: "Krótki opis (tooltip)" / "Short description (tooltip)"
- `description`: "Pełny opis" / "Full description"
- `save`: "Zapisz" / "Save"
- `cancel`: "Anuluj" / "Cancel"
- `saved`: "Zapisano zmiany" / "Changes saved"
- `saveError`: "Nie udało się zapisać" / "Failed to save"
- `missingShort`: "brak opisu" / "no description"

Also add `adminTalents` nav label to the layout's namespace (find where `adminSettings`/`adminUsers` labels live): PL "Talenty", EN "Talents".

- [ ] **Step 3: Sidebar link**

In `frontend/app/(dashboard)/layout.tsx` `adminNavigation` array (~line 156) add (import an unused lucide icon, e.g. `Sparkles`):

```tsx
{ name: t("adminTalents"), href: "/dashboard/admin/talents", icon: Sparkles },
```

- [ ] **Step 4: Admin talents page**

First read `frontend/app/(dashboard)/dashboard/admin/knowledge/page.tsx` and `admin/settings/page.tsx` to copy conventions (role guard/redirect for non-admins, loading state, dialog usage — `components/ui/dialog.tsx` and `tabs.tsx` exist). Then create `frontend/app/(dashboard)/dashboard/admin/talents/page.tsx`:

Structure (follow existing patterns for the exact boilerplate):
- `"use client"`; load `api.admin.listTalents()` on mount; admin-role guard identical to other admin pages.
- Group talents by domain using `DOMAIN_LABELS` and `getDomainStyle` from `@/lib/gallup-data`; render four domain sections, each a card (`bg-white rounded-2xl border border-slate-200 shadow-sm`) with a colored heading.
- Each talent row shows: PL name, EN name, PL short description (or an amber `missingShort` badge when empty), and an `edit` button.
- Edit opens the shadcn `Dialog` with `Tabs` (PL / EN). Each tab: `Input` for name, `Textarea` (maxLength 500) for short description, larger `Textarea` for full description. Local form state initialized from the talent's translation for that language (missing translation → empty fields).
- Save: call `api.admin.updateTalentTranslation(talent.id, lang, changedFields)` for each language tab whose fields changed; on success close the dialog, update local list state, show the `saved` toast/inline notice pattern used by other admin pages; on failure show `saveError`.
- Page root: full width is fine (tabular admin page — no local cap needed).

- [ ] **Step 5: Build + verify end-to-end**

Run: `cd frontend && npx next build 2>&1 | tail -20` → success.
Dev stack: log in as admin → sidebar shows "Talenty" → page lists 34 talents grouped by domain → edit a PL short description → save → reload page (persisted) → open a team matrix and hover that talent: tooltip shows the edited text. Also verify a non-admin user cannot see the page (redirect/guard).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/api.ts "frontend/app/(dashboard)/dashboard/admin/talents/page.tsx" "frontend/app/(dashboard)/layout.tsx" frontend/messages/pl.json frontend/messages/en.json
git commit -m "feat(frontend): admin CMS page for talent names and descriptions"
```

---

### Task 7: Full visual verification pass

**Files:** none (verification only; fix regressions found, committing fixes to the files above).

- [ ] **Step 1: Walk every dashboard page**

With the dev stack running (backend :8001), visit: dashboard home, teams list, team detail (all three tabs: Matryca/Domeny/Profile), compare, users, organizations, qa, tips, my-talents, settings, admin/knowledge, admin/users, admin/settings, admin/talents. For each: no horizontal page scroll, no broken layout, sidebar collapsed AND expanded.

- [ ] **Step 2: Matrix acceptance check**

At 1440 px and 1920 px viewports with collapsed sidebar: the full 34-column matrix fits without scroll; tooltips work on first and last columns (no viewport clipping).

- [ ] **Step 3: Run both test suites one last time**

`cd backend && python -m pytest tests/ -v` → no new failures.
`cd frontend && npx next build 2>&1 | tail -5` → success.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(frontend): visual polish after full-width layout verification"
```

(Skip if nothing changed.)
