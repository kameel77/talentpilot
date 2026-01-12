# Local Deployment Procedure (Docker Desktop)

This document describes how to run the TalentPilot stack locally on Docker Desktop and ensure required ports are free before starting services.

## Prerequisites
- Docker Desktop installed and running.
- Node.js (for frontend) and Python (for backend) available locally if you want to run them outside Docker.
- Recommended Python version: **3.11 or 3.12** for best compatibility with database drivers.
- Ports `3000`, `8000`, `5432`, and `6379` free (frontend, backend, Postgres, Redis).

## 1) Verify Docker Desktop
Open Docker Desktop and confirm the engine is running.

Optional CLI check:
```bash
docker info
```
If you see warnings like:
- `docker-dev` plugin missing
- `DOCKER_INSECURE_NO_IPTABLES_RAW is set`

You can continue. The first is a non-critical plugin warning. The second means iptables RAW rules are not applied inside the Docker Desktop VM; it does not block local development but may affect advanced networking or firewall behaviors.

## 2) Ensure Required Ports Are Free
Check if any process is already bound to the ports required by the stack:
```bash
lsof -iTCP:3000 -sTCP:LISTEN
lsof -iTCP:8000 -sTCP:LISTEN
lsof -iTCP:5432 -sTCP:LISTEN
lsof -iTCP:6379 -sTCP:LISTEN
```

If any command returns a process, stop it before continuing. Example:
```bash
kill -9 <PID>
```

### Safe Port Release Tips
If a port is busy, prefer a graceful stop:
- For Docker services started by you, use `docker compose down` in the project where they run.
- For local services (e.g. Postgres installed on macOS), stop them with their service manager.
  - Example (Homebrew): `brew services stop postgresql`
- For a dev server (e.g. Next.js), stop the terminal session or use `kill <PID>`.

### Impact on Docker Desktop
- If port `6379` (or others) is used by `com.docker` processes, it usually means a Docker container is already bound to that port.
- Docker Desktop itself can listen on ports when containers are running; the impact is that `docker compose up` will fail with “port already in use” unless you stop the container that owns the port.
- Stopping Docker Desktop will free all ports owned by Docker containers, but it will also stop all containers across projects.

## 3) Start Services (Docker Compose)
From the project root:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot
docker compose up -d
```

This should start:
- PostgreSQL with `pgvector`
- (Optional) Redis, if included in `docker-compose.yml`

## 4) Run Backend (FastAPI)
From the backend folder:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Note: Python 3.13 can cause build failures for dependencies like `psycopg2-binary` (missing wheels). Use 3.11/3.12 unless you install Postgres dev tools and `pg_config`.

## 5) Initialize Database Schema (Alembic)
If you see errors like `relation "users" does not exist`, you need to create and apply migrations.

Docker flow:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot
docker compose exec backend alembic revision --autogenerate -m "init"
docker compose exec backend alembic upgrade head
```

Local (venv) flow:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot/backend
alembic revision --autogenerate -m "init"
alembic upgrade head
```

## 6) Run Frontend (Next.js)
From the frontend folder:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot/frontend
npm install
npm run dev
```

Frontend should be available at `http://localhost:3000`.

## 7) Verify Ports After Start
Confirm the services are listening:
```bash
lsof -iTCP:3000 -sTCP:LISTEN
lsof -iTCP:8000 -sTCP:LISTEN
lsof -iTCP:5432 -sTCP:LISTEN
```

## 8) Shut Down
Stop services when done:
```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/talentpilot
docker compose down
```

If you started backend/frontend locally, stop them with `CTRL+C`.
