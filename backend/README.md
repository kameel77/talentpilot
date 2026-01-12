# TalentPilot Backend

Manager Copilot powered by CliftonStrengths - FastAPI Backend

## Features

- 🚀 FastAPI with async support
- 🔐 JWT authentication with role-based access control
- 🗄️ PostgreSQL with pgvector for AI/RAG
- 📊 34 CliftonStrengths talents pre-loaded
- 🏢 Multi-tenancy support
- 🤖 AI Tips powered by OpenAI

## Requirements

- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- Redis (optional, for caching)

## Quick Start

### 1. Setup Environment

```bash
# Copy env template
cp .env.example .env

# Edit .env and add your secrets:
# - DATABASE_URL
# - JWT_SECRET (generate with: openssl rand -hex 32)
# - OPENAI_API_KEY
```

### 2. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Initialize Database

```bash
# Run migrations
alembic upgrade head

# Seed 34 CliftonStrengths talents
python scripts/seed_talents.py
```

### 4. Run Development Server

```bash
# Start the server
uvicorn main:app --reload

# API will be available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

## Project Structure

```
backend/
├── alembic/              # Database migrations
├── scripts/              # Utility scripts (seeding, etc.)
├── main.py               # FastAPI application
├── config.py             # Configuration
├── database.py           # Database connection
├── models.py             # SQLAlchemy models
├── schemas.py            # Pydantic schemas
├── auth.py               # Authentication utilities
└── requirements.txt      # Python dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new organization + admin
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user details

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/{id}` - Get organization details

### Teams
- `POST /api/teams` - Create team
- `GET /api/teams` - List teams
- `GET /api/teams/{id}` - Get team details

### Users
- `POST /api/users` - Add user to organization
- `GET /api/users` - List users
- `GET /api/users/{id}` - Get user details with talents

### Talents
- `GET /api/talents` - List all 34 talents
- `GET /api/domains` - List 4 Gallup domains
- `POST /api/users/{id}/talents` - Assign Top 5 talents to user

### AI Tips (Week 4)
- `GET /api/tips/daily` - Get daily AI tip
- `POST /api/tips/feedback` - Submit feedback on tip

## Database Models

- **Organization** - Multi-tenant organization
- **User** - User with role (admin/manager/user)
- **Team** - Team within organization
- **Talent** - 34 CliftonStrengths talents (read-only)
- **UserTalent** - User's Top 5 talents with ranking
- **KnowledgeBase** - RAG knowledge base with embeddings
- **AITip** - AI-generated tips with user feedback

## Development

### Run Tests

```bash
pytest tests/ -v
```

### Create Migration

```bash
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Format Code

```bash
black .
isort .
```

## Deployment

See `docker-compose.yml` in project root for full stack deployment.

## License

Proprietary
