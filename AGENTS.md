# Role & Context: Talent-Driven Management OS

## Core Mission
Budujemy aplikację "Manager Copilot" opartą na metodologii CliftonStrengths (Gallup). Aplikacja nie jest tylko bazą danych talentów, ale "tłumaczem" predyspozycji na konkretne kompetencje biznesowe i codzienne działania managerskie.

## Guardrails dla Agenta
1. **Technologia:** Backend: Python (FastAPI), Frontend: Next.js (React), Database: PostgreSQL + pgvector.
2. **Styl UI:** Modern SaaS, Clean, Mobile-First (PWA). Używamy Tailwind CSS + shadcn/ui + Framer Motion.
3. **Merytoryka:** Skupiamy się na transformacji "Talent -> Kompetencja -> Akcja". Unikamy ogólników.
4. **Prywatność:** Dane talentowe są wrażliwe. Projektuj system z myślą o separacji danych (Multi-tenancy).

## Tone of Voice
Profesjonalny, pomocny doradca, analityczny, ale skupiony na empatii w zespole.

## 2) Tryby pracy agenta
### Tryb A: Plan (domyślny)
Agent:
1) doprecyzowuje cel (co jest “done”),
2) wypisuje listę plików, które dotknie,
3) proponuje komendy do uruchomienia,
4) identyfikuje ryzyka/regresje.

### Tryb B: Build (gdy plan zaakceptowany)
Agent:
1) robi zmiany w małych porcjach,
2) po każdej porcji uruchamia testy/lint (lub minimalny subset),
3) pokazuje diff / listę zmian,
4) proponuje kolejne kroki.

---

## 3) Zasady edycji i bezpieczeństwa
### Zasady edycji
- Nie zmieniaj formatowania “przy okazji”.
- Nie refaktoryzuj niezwiązanych obszarów bez uzasadnienia.
- Każda zmiana musi mieć powód i opis.

### Zasady komend
Agent **musi pytać o zgodę** zanim wykona:
- komendy destrukcyjne (np. `rm`, `rebase`, `push --force`, migracje DB),
- modyfikacje lockfile lub masowe aktualizacje zależności,
- operacje na sekretach / `.env` / kluczach / credentialach.

### Sekrety i dane wrażliwe
- Nie wklejaj sekretów w treść promptów ani w pliki.
- Jeśli coś wymaga sekretu, agent ma poprosić o użycie bezpiecznego mechanizmu (np. lokalny `.env` bez commita).

---

## 4) Definition of Done (DoD)
Zmiana jest “done”, gdy:
- kod się buduje,
- testy przechodzą (wskazany zakres),
- lint/format przechodzi,
- zmiana jest opisana (co/why/how),
- ryzyka i regresje są ocenione.

---

## 5) Standardowy workflow (zalecany)
1) Agent przygotowuje PLAN (w punktach).
2) Użytkownik akceptuje plan lub koryguje.
3) Agent implementuje w małych krokach.
4) Agent uruchamia testy/lint.
5) Agent podaje podsumowanie + instrukcję weryfikacji (manual QA).
6) (Opcjonalnie) Agent proponuje treść PR/commit message.

---

## 6) Komendy projektu

### Frontend (Next.js)
```bash
cd frontend
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Backend (FastAPI)
```bash
cd backend
uvicorn main:app --reload     # Start development server (localhost:8000)
pytest                         # Run all tests
pytest tests/test_specific.py  # Run single test file
pytest -k "test_name"         # Run specific test
pytest --cov=.                 # Run tests with coverage
```

### Database
```bash
cd backend
alembic upgrade head         # Apply migrations
alembic revision --autogenerate -m "message"  # Create migration
alembic downgrade -1         # Rollback one migration
```

---

## 7) Zasady dla zmian UI/UX
- Jeśli zmiana dotyczy UI: agent wskazuje elementy “przed/po” i proponuje checklistę manual QA.
- Jeśli używamy design systemu / tokenów: agent ma preferować **reuse** zamiast kopiowania ad-hoc.
- Jeśli kopiujemy komponenty/styl: agent najpierw identyfikuje “źródło prawdy” (tokeny, komponenty bazowe).

---

## 8) Multi-repo / monorepo-like (ważne)
W katalogu roboczym mogą istnieć repozytoria:
- `/github/talentpilot` (Repo A)
- `/github/talent-navigator` (Repo B)

### Cel cross-repo
Czasem potrzebujemy przenieść UI (layout, komponenty, tokeny) z Repo A do Repo B.

### Zasady cross-repo (twarde)
1) Agent **może czytać** pliki z Repo A, aby odtworzyć wzorce UI w Repo B.
2) Agent **nie może edytować** Repo A bez wyraźnego polecenia.
3) Zmiany implementujemy jako:
   - (preferowane) wydzielenie współdzielonego pakietu / biblioteki / design tokens,
   - (alternatywa) kontrolowane skopiowanie komponentów z pełnym uzasadnieniem.

### Procedura przenoszenia UI (krok po kroku)
1) Agent wskazuje dokładnie: które ekrany/komponenty są “źródłem” w Repo A.
2) Agent identyfikuje zależności: tokeny, klasy, biblioteki UI, assety, fonty.
3) Agent przygotowuje mapę: “co mapujemy 1:1”, a co trzeba zaadaptować.
4) Agent implementuje w Repo B, zaczynając od tokenów/stylu, potem komponentów, na końcu stron.
5) Agent uruchamia testy + manual QA checklistę.
6) Agent na końcu daje listę plików dotkniętych w Repo B.

---

## 9) Code Style Guidelines

### TypeScript/React
- **Imports:** External libraries first, then internal modules, then relative imports
- **Components:** Use function components with TypeScript interfaces for props
- **Styling:** Tailwind CSS with `cn()` utility from `@/lib/utils` for conditional classes
- **UI Components:** Follow shadcn/ui patterns, use `className` prop for styling
- **State:** React hooks for local state, consider Zustand/Redux for global state
- **Forms:** React Hook Form with Zod validation
- **Error Handling:** Try-catch with user-friendly error messages, error boundaries

**Example Component Structure:**
```tsx
import { cn } from "@/lib/utils";
import React from "react";

interface ComponentProps {
  title: string;
  className?: string;
}

export function Component({ title, className }: ComponentProps) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
```

### Python/FastAPI
- **Imports:** Standard library first, then third-party, then local imports
- **Models:** SQLAlchemy models with proper relationships and enums
- **API Routes:** Use Pydantic for request/response validation
- **Dependencies:** FastAPI dependency injection for database sessions, auth
- **Error Handling:** HTTPException with proper status codes
- **Testing:** pytest with fixtures, mock external dependencies

**Example Route Structure:**
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas import ItemCreate, ItemResponse
from models import Item
from database import get_db

router = APIRouter(prefix="/api/items", tags=["Items"])

@router.post("/", response_model=ItemResponse)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
```

## 10) Naming Conventions

### TypeScript/React
- **Components:** PascalCase (e.g., `KPICard`, `UserManualCard`)
- **Files:** PascalCase for components (e.g., `KPICard.tsx`)
- **Variables:** camelCase (e.g., `userName`, `isLoading`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Interfaces:** PascalCase with `Props` suffix for component props

### Python
- **Classes:** PascalCase (e.g., `User`, `TalentTranslation`)
- **Functions/Variables:** snake_case (e.g., `get_user`, `is_active`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `DATABASE_URL`)
- **Files:** snake_case (e.g., `user_service.py`)

## 11) Komunikacja i raportowanie
Po każdej iteracji agent zwraca:
- Co zrobił (2–6 punktów)
- Jakie pliki zmienił
- Jakie komendy uruchomił i wyniki
- Co dalej (kolejne 1–3 kroki)
- Ryzyka/regresje do sprawdzenia

---

## 12) Infrastruktura i środowiska

### Architektura ogólna

Aplikacja jest wdrożona na dwóch serwerach Hetzner, zarządzanych przez Coolify. Każde środowisko ma osobną instancję PostgreSQL (z pgvector), Redis i aplikację docker-compose (backend + frontend).

```
┌─────────────────────────────────────────────────────────────┐
│  DEV (izzy-hetzner / 37.27.193.161)                         │
│  Coolify: https://cool.izzycars.pl                          │
│  MCP: coolify-staging                                       │
│  SSH: ssh izzy-dev                                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ PostgreSQL│  │  Redis   │  │  Aplikacja (branch: dev) │  │
│  │ pgvector  │  │          │  │  FE: dev.talentpilot.io  │  │
│  │           │  │          │  │  BE: sslip.io (internal) │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PROD (hetzner-priv / 204.168.226.1)                        │
│  Coolify: http://204.168.226.1:8000                         │
│  MCP: coolify (coolify-finarena)                            │
│  SSH: ssh hetzner-priv                                      │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ PostgreSQL│  │  Redis   │  │  Aplikacja (branch: main)│  │
│  │ pgvector  │  │          │  │  FE: app.talentpilot.io  │  │
│  │           │  │          │  │  BE: api.talentpilot.io  │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Identyfikatory zasobów Coolify

#### DEV (coolify-staging)
| Zasób | UUID | Host wewnętrzny (Docker) |
|---|---|---|
| PostgreSQL | `aocw0cc8c8oo0084cokoscgs` | `aocw0cc8c8oo0084cokoscgs:5432` |
| Redis | `boowwskogcocckgogokokko4` | `boowwskogcocckgogokokko4:6379` |
| Aplikacja | `awk0c0800ks8sk4o004gok0g` | branch: `dev` |

#### PROD (coolify-finarena)
| Zasób | UUID | Host wewnętrzny (Docker) |
|---|---|---|
| PostgreSQL | `vce9dy97ni31uox7og3opa32` | `vce9dy97ni31uox7og3opa32:5432` |
| Redis | `dc6v4uuhhaj8omrtp33ha4bo` | `dc6v4uuhhaj8omrtp33ha4bo:6379` |
| Aplikacja | `vkppfv54xt5zvdli2pwqcv5d` | branch: `main` |

### Domeny i DNS (Cloudflare)

| Domena | IP | Środowisko | Cel |
|---|---|---|---|
| `app.talentpilot.io` | `204.168.226.1` | PROD | Frontend |
| `api.talentpilot.io` | `204.168.226.1` | PROD | Backend |
| `dev.talentpilot.io` | `37.27.193.161` | DEV | Frontend |
| Backend DEV | sslip.io (auto) | DEV | Backend |

### Dostęp MCP do Coolify

Agent ma dostęp do obu instancji Coolify przez MCP:

- **DEV:** użyj narzędzi `mcp_coolify-staging_*` (np. `mcp_coolify-staging_applications`)
- **PROD:** użyj narzędzi `mcp_coolify_*` (np. `mcp_coolify_applications`)

Alternatywnie przez API (curl):
```bash
# DEV
curl -H "Authorization: Bearer 7|SfZ5mPP5pGfjpCjlIHx1P8bkl7z5ydHGhYVb3y9M43a88b94" \
  https://cool.izzycars.pl/api/v1/...

# PROD
curl -H "Authorization: Bearer 1|fMaZGmvXFfO76O1WYurFqHEKghJYj7T93kaSYs1jb469ab74" \
  http://204.168.226.1:8000/api/v1/...
```

### Sieć Docker

Bazy danych i aplikacja komunikują się przez sieć `coolify` (external Docker network). Hosty baz danych to ich UUIDs w Coolify (np. `aocw0cc8c8oo0084cokoscgs:5432`). **Nie** używamy `localhost` ani nazw serwisów z docker-compose dla baz danych — bazy są osobnymi zasobami Coolify.

---

## 13) Branching i deployment workflow

### Strategia branchy

```
dev  ──────────────────────────────►  Coolify DEV (dev.talentpilot.io)
 │                                        ▲ auto-deploy on push
 │                                        │
 └──── merge ──► main ──────────────►  Coolify PROD (app.talentpilot.io)
                                          ▲ auto-deploy on push
```

- **`dev`** — branch roboczy. Cały development odbywa się tutaj.
- **`main`** — branch produkcyjny. Tylko merge z `dev` po przetestowaniu.

### Workflow krok po kroku

1. **Rozwój:** Pracuj na branchu `dev` lokalnie.
2. **Push:** `git push origin dev` → Coolify DEV automatycznie deployuje.
3. **Testowanie:** Weryfikuj na `https://dev.talentpilot.io`.
4. **Merge do produkcji:**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```
5. **Weryfikacja produkcji:** Sprawdź `https://app.talentpilot.io`.

### Deploy manualny (przez MCP/API)

Jeśli auto-deploy nie zadziała lub potrzebny jest force rebuild:

```bash
# DEV — przez MCP
mcp_coolify-staging_deployments(operation="deploy", query='{"uuid":"awk0c0800ks8sk4o004gok0g","force_rebuild":true}')

# PROD — przez MCP
mcp_coolify_deployments(operation="deploy", query='{"uuid":"vkppfv54xt5zvdli2pwqcv5d","force_rebuild":true}')
```

### Ważne uwagi o env vars

- **`NEXT_PUBLIC_API_URL`** jest zmienną **build-time** Next.js — zmiana wymaga `force_rebuild:true`.
- **`CORS_ORIGINS`** musi zawierać URL frontendu (np. `https://app.talentpilot.io`).
- Coolify potrafi generować duplikaty env vars — zawsze weryfikuj `docker exec <container> env | grep KEY`.
- Cloudflare proxy (pomarańczowa chmurka) terminuje SSL — Traefik widzi HTTP, domena musi być z `https://` w Coolify.

### Logi i debugging

```bash
# Logi backendu DEV
ssh izzy-dev 'docker logs $(docker ps --format "{{.Names}}" | grep "^backend-awk0c0800" | head -1) --tail 50'

# Logi backendu PROD
ssh hetzner-priv 'docker logs $(docker ps --format "{{.Names}}" | grep "^backend-vkppfv54" | head -1) --tail 50'

# Env vars w kontenerze
ssh hetzner-priv 'docker exec $(docker ps --format "{{.Names}}" | grep "^backend-vkppfv54" | head -1) env | grep CORS'
```

### Backup i migracja danych

```bash
# Export backup z serwera
ssh <server> 'docker exec <postgres-container-uuid> pg_dump -U talentpilot talentpilot > /tmp/backup.sql'

# Import na inny serwer
scp <source>:/tmp/backup.sql <dest>:/tmp/backup.sql
ssh <dest> 'docker exec -i <postgres-container-uuid> psql -U talentpilot -d talentpilot < /tmp/backup.sql'
```