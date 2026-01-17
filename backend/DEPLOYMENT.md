# Deployment Guide - TalentPilot

## Prerequisites

- Docker & Docker Compose (for containerized deployment)
- Python 3.11+ (for local development)
- PostgreSQL 15+ (for local development)

---

## Local Development

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac: venv\Scripts\activate (Windows)

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your local settings
# Required:
# - DATABASE_URL=postgresql://user:password@localhost:5432/talentpilot
# - JWT_SECRET=$(openssl rand -hex 32)
# - OPENAI_API_KEY=your_key_here
```

### 2. Initialize Database

```bash
# Run database migrations
alembic upgrade head

# CRITICAL: Seed 34 CliftonStrengths talents
python scripts/seed_talents.py

# Verify talents were added
python -c "from database import SessionLocal; db = SessionLocal(); print(f'Talents in DB: {db.execute(\"SELECT COUNT(*) FROM talents\").scalar()}')"
```

### 3. Run Development Server

```bash
uvicorn main:app --reload
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

### 4. Frontend Setup (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000

---

## Online Deployment (Coolify)

### 1. First Deployment Checklist

When deploying for the first time to Coolify:

#### A. Backend Configuration

1. In Coolify, create a new service for the backend
2. Set environment variables:
   ```
   DATABASE_URL=postgresql://talentpilot:talentpilot@postgres:5432/talentpilot
   JWT_SECRET=your_generated_secret
   OPENAI_API_KEY=your_openai_key
   DEBUG=false
   ```
3. Build command: `pip install -r requirements.txt`
4. Run command: `uvicorn main:app --host 0.0.0.0 --port 8000`

#### B. Database Setup

1. Wait for PostgreSQL container to start
2. Run migrations:
   ```bash
   docker exec -it <backend_container_id> alembic upgrade head
   ```

3. **CRITICAL: Seed talents** - run inside backend container:
   ```bash
   docker exec -it <backend_container_id> /bin/bash
   cd /app
   python scripts/seed_talents.py
   exit
   ```

4. Verify:
   ```bash
   docker exec -it <postgres_container_id> psql -U talentpilot -d talentpilot -c "SELECT COUNT(*) FROM talents;"
   # Should return: 34
   ```

#### C. Frontend Configuration

1. Create a new service for frontend in Coolify
2. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.37.27.193.161.sslip.io
   ```
3. Build command: `npm install && npm run build`
4. Run command: `npm run start`

### 2. Updating Existing Deployment

```bash
# Pull latest code (via Coolify git integration)
# Coolify will automatically rebuild

# If database schema changed:
docker exec -it <backend_container_id> alembic upgrade head

# If seed data changed:
docker exec -it <backend_container_id> /bin/bash
cd /app
python scripts/seed_talents.py
exit
```

### 3. Coolify Service Names (Reference)

Current deployment:
- Backend: `backend-awk0c0800ks8sk4o004gok0g-171550099459`
- Frontend: `frontend-awk0c0800ks8sk4o004gok0g-171550120114`
- PostgreSQL: `postgres-awk0c0800ks8sk4o004gok0g-171550064406`
- Redis: `redis-awk0c0800ks8sk4o004gok0g-171550083435`

### 4. Useful Docker Commands

```bash
# View running containers
docker ps | grep talentpilot

# Check backend logs
docker logs -f <backend_container_id>

# Access PostgreSQL
docker exec -it <postgres_container_id> psql -U talentpilot -d talentpilot

# Access backend container
docker exec -it <backend_container_id> /bin/bash

# Restart service
docker restart <backend_container_id>
```

---

## Troubleshooting

### "No talents in database" error

```bash
# Check talents count
docker exec -it <postgres_container_id> psql -U talentpilot -d talentpilot -c "SELECT COUNT(*) FROM talents;"

# If 0, seed them
docker exec -it <backend_container_id> /bin/bash
cd /app
python scripts/seed_talents.py
exit
```

### PDF parser returns only 10 talents

1. Check logs for parser output:
   ```bash
   docker logs <backend_container_id> 2>&1 | grep "PDF Parser"
   ```

2. Verify all 34 talents in database:
   ```sql
   SELECT code FROM talents ORDER BY code;
   ```

### User talents not saving

```bash
# Check user_talents table
docker exec -it <postgres_container_id> psql -U talentpilot -d talentpilot -c "SELECT * FROM user_talents LIMIT 5;"

# Verify talent IDs exist
docker exec -it <postgres_container_id> psql -U talentpilot -d talentpilot -c "SELECT id, code FROM talents LIMIT 5;"
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT signing (generate with `openssl rand -hex 32`) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `DEBUG` | No | Enable debug mode (default: false) |
| `COOLIFY_URL` | No | Coolify URL for webhooks |
| `COOLIFY_FQDN` | No | Coolify FQDN |

### Frontend (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

---

## CI/CD Pipeline (Future)

When setting up automated deployments:

```yaml
# Example GitHub Actions workflow
- name: Run migrations
  run: |
    docker exec backend alembic upgrade head

- name: Seed talents
  run: |
    docker exec backend python scripts/seed_talents.py
```

---

## Security Notes

- Never commit `.env` files with real secrets
- Use Coolify's secret management for production
- Rotate `JWT_SECRET` periodically
- Keep `OPENAI_API_KEY` secure
