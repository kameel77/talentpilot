# TalentPilot

Manager Copilot powered by CliftonStrengths - Transform talents into actionable insights

## Overview

TalentPilot is an intelligent management assistant that leverages the CliftonStrengths methodology to help managers understand their team members' talents and translate them into practical, day-to-day management actions.

## Features

- 🎯 **34 CliftonStrengths Talents** - Complete integration with Gallup's talent framework
- 🏢 **Multi-Tenancy** - Support for multiple organizations
- 👥 **Team Management** - Organize and visualize team talent distributions
- 🤖 **AI-Powered Insights** - RAG-based tips and recommendations
- 📱 **PWA Ready** - Installable mobile-first application
- 🔐 **Role-Based Access** - Admin, Manager, and User roles

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Database with pgvector extension for AI
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **OpenAI API** - Embeddings and AI tips

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Framer Motion** - Animations

### Infrastructure
- **Docker Compose** - Local development
- **Hetzner + Coolify** - Production deployment

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/talentpilot.git
cd talentpilot
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed 34 CliftonStrengths talents
python scripts/seed_talents.py
```

### 3. Setup Frontend

```bash
cd frontend
npm install
```

### 4. Run with Docker Compose (Recommended)

```bash
# From project root
docker-compose up -d
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 5. Run Manually (Development)

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Project Structure

```
talentpilot/
├── backend/              # FastAPI backend
│   ├── alembic/         # Database migrations
│   ├── scripts/         # Utility scripts
│   ├── main.py          # FastAPI app
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   └── auth.py          # JWT authentication
├── frontend/            # Next.js frontend
│   ├── app/            # App Router pages
│   ├── components/     # React components
│   ├── lib/            # Utilities & API client
│   └── public/         # Static assets
├── docs/               # Documentation
└── docker-compose.yml  # Docker setup
```

## Documentation

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Architecture Plan](docs/ARCHITECTURE_PLAN.md)
- [MVP Action Plan](docs/MVP_ACTION_PLAN.md)
- [Product Features](docs/PRODUCT_FREATURES.md)

## Development Roadmap

### ✅ Week 1: Setup & Data Model (Completed)
- Backend setup with FastAPI
- Database models and migrations
- Frontend setup with Next.js 14
- Docker infrastructure

### 🔄 Week 2: Core Engine (In Progress)
- CRUD API endpoints
- Authentication pages
- Dashboard layout
- Team management

### 📋 Week 3: UI/UX & Visualization
- Team Grid component
- User Manual cards
- Domain charts
- PWA features

### 🤖 Week 4: AI & RAG
- pgvector integration
- AI Tips generation
- Daily Guidance
- Feedback loop

## Contributing

This is a proprietary project. Contributions are limited to authorized team members.

## License

Proprietary - All rights reserved

## Contact

For questions or support, please contact the development team.
