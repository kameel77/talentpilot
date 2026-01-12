# TalentPilot Frontend

Manager Copilot powered by CliftonStrengths - Next.js Frontend

## Features

- ⚛️ Next.js 14 with App Router
- 🎨 Tailwind CSS + shadcn/ui components
- 🔐 JWT authentication with token management
- 📱 PWA-ready (installable app)
- 🎭 Framer Motion animations
- 📊 Modern, mobile-first UI

## Requirements

- Node.js 20+
- npm

## Quick Start

### 1. Setup Environment

```bash
# Copy env template (create one if needed)
cp .env.local.example .env.local

# Edit .env.local and set:
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

App will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes (login, register)
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/
│   ├── ui/                # shadcn/ui base components
│   └── ...                # Custom components
├── lib/
│   ├── api.ts             # API client with JWT
│   └── utils.ts           # Utilities
├── public/
│   └── manifest.json      # PWA manifest
└── tailwind.config.ts     # Tailwind configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## API Integration

The app uses `lib/api.ts` for all backend communication:

```typescript
import { api, tokenManager } from '@/lib/api';

// Login
const { access_token } = await api.auth.login({ email, password });
tokenManager.setToken(access_token);

// Get current user
const user = await api.auth.getCurrentUser();

// Fetch teams
const teams = await api.teams.list();
```

## Deployment

See `docker-compose.yml` in project root for full stack deployment with backend.

## License

Proprietary
