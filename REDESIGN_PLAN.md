# REDESIGN_PLAN - Migracja z Talent-Navigator do TalentPilot

## Cel projektu
Migracja wszystkich stron i komponentów z projektu graficznego `talent-navigator` (Vite + React Router) do głównego projektu `talentpilot` (Next.js 16 + App Router) z zachowaniem pełnej funkcjonalności i design system.

---

## Przegląd projektów

### Talent-Navigator (Źródło - projekt graficzny)
- **Tech Stack**: Vite, React 18, React Router DOM, Tailwind CSS 3.4
- **Struktura**: React SPA z routingiem klienta
- **Cel**: Prezentacja UI/UX z mock data

### TalentPilot (Cel - główny projekt)
- **Tech Stack**: Next.js 16, React 19, App Router, Tailwind CSS 4
- **Struktura**: Server-side rendering with App Router
- **Cel**: Produkcyjna aplikacja z backendem (FastAPI + PostgreSQL)

---

## Status Migracji

### ✅ Zakończone (1/7)
- SettingsPage → `/settings` (2025-01-16)

### 🔄 W trakcie (0/7)
- *Brak migracji w trakcie*

### ⏳ Oczekujące (6/7)
- LandingPage → `/`
- AuthPage → `/auth`
- DashboardPage → `/dashboard`
- TeamPage → `/team`
- ComparePage → `/compare`
- TipsPage → `/tips`

---

## Szczegółowa lista przeniesionych plików

### SettingsPage (✅ Zakończone)

#### Nowe komponenty stworzone:
1. **frontend/components/ui/switch.tsx** - Switch komponent z @radix-ui/react-switch
2. **frontend/components/ui/tabs.tsx** - Tabs komponent z @radix-ui/react-tabs
3. **frontend/components/ui/dialog.tsx** - Dialog komponent z @radix-ui/react-dialog
4. **frontend/components/ui/label.tsx** - Label komponent z @radix-ui/react-label
5. **frontend/components/ui/input.tsx** - Input komponent (shadcn/ui pattern)
6. **frontend/components/ui/button.tsx** - Button komponent z custom wariantami (hero, glass, warm)

#### Feature components stworzone:
1. **frontend/components/dashboard/SettingsSection.tsx** - Reusable sekcja ustawień
2. **frontend/components/talent-import/TalentImportDialog.tsx** - Dialog do importu talentów (PDF + manual)

#### Strony stworzone/zaktualizowane:
1. **frontend/app/(dashboard)/settings/page.tsx** - Pełna strona ustawień

#### Zaktualizowane pliki:
1. **frontend/app/(dashboard)/layout.tsx** - Dodano Settings do nawigacji sidebar
2. **frontend/app/globals.css** - Dodano custom utilities (typografia, gradients, shadows)

#### Nowe zależności zainstalowane:
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-dialog
- @radix-ui/react-label
- @radix-ui/react-slot

---

## Strony do migracji

### 1. LandingPage → `/`
- **Ścieżka docelowa**: `frontend/app/page.tsx`
- **Opis**: Strona główna z sekcjami Hero, Domains, Features, CTA
- **Kluczowe elementy**:
  - Hero section z gradientem i animacjami
  - 4 karty domen (Realizacja, Wpływanie, Budowanie relacji, Myślenie strategiczne)
  - 6 sekcji features z ikonami
  - CTA section z gradientem
  - Footer
- **Rozbieżności**: React Router `Link` → Next.js `Link`

### 2. AuthPage → `/auth`
- **Ścieżka docelowa**: `frontend/app/(auth)/login/page.tsx` i `frontend/app/(auth)/register/page.tsx`
- **Opis**: Połączona strona logowania/rejestracji/resetu hasła
- **Kluczowe elementy**:
  - 3 tryby: login, signup, reset
  - Left: Formularz z walidacją
  - Right: Hero section z gradientem (desktop only)
- **Rozbieżności**: State management zamiast routing URL
- **Wyzwania**: Integracja z backend auth API

### 3. DashboardPage → `/dashboard`
- **Ścieżka docelowa**: `frontend/app/(dashboard)/dashboard/page.tsx`
- **Opis**: Panel główny menedżera
- **Kluczowe elementy**:
  - 4 KPICards (Członków zespołu, Zaimportowane talenty, Porównań 1:1, Zaangażowanie)
  - DomainChart (wykres kołowy)
  - Daily Tip card z gradientem
  - Grid TeamMemberCard (4 członków)
- **Rozbieżności**: Mock data → Real API data

### 4. TeamPage → `/team`
- **Ścieżka docelowa**: `frontend/app/(dashboard)/team/page.tsx`
- **Opis**: Przegląd zespołu z detalami pracownika
- **Kluczowe elementy**:
  - Search + Filters po domenach
  - Grid TeamMemberCard
  - Employee Profile (subpage) z:
    - Talenty grupowane po domenach
    - Strengths, Triggers, Blockers
    - Feedback guidance
- **Rozbieżności**: Subpage z parametrem ID → `frontend/app/(dashboard)/team/[id]/page.tsx`

### 5. ComparePage → `/compare`
- **Ścieżka docelowa**: `frontend/app/(dashboard)/compare/page.tsx`
- **Opis**: Porównanie 1:1 dwóch osób
- **Kluczowe elementy**:
  - Selection mode (wybór 2 osób)
  - Results view z:
    - Bridges (wspólne talenty, komplementarność)
    - Barriers (potencjalne konflikty)
    - Tips (wskazówki do współpracy)
- **Wyzwania**: Logika porównania talents

### 6. TipsPage → `/tips`
- **Ścieżka docelowa**: `frontend/app/(dashboard)/tips/page.tsx`
- **Opis**: Dzienna wskazówka AI
- **Kluczowe elementy**:
  - Main tip card z kategorią i domeną
  - Feedback (helpful/not helpful)
  - Navigation (prev/next)
  - Tips history
- **Wyzwania**: Integracja z AI backend

### 7. SettingsPage → `/settings`
- **Ścieżka docelowa**: `frontend/app/(dashboard)/settings/page.tsx`
- **Opis**: Ustawienia konta i organizacji
- **Kluczowe elementy**:
  - Organization info
  - Talent Import (PDF parser + manual input)
  - Team management (role-based access)
  - Notifications toggles
  - Privacy & Security
  - Extensions (post-MVP)
- **Wyzwania**: Integracja z TalentImportDialog

---

## Komponenty do migracji

### Komponenty Layout

#### AppLayout → SidebarLayout
- **Lokalizacja**: `frontend/components/dashboard/SidebarLayout.tsx`
- **Opis**: Główny layout z collapsible sidebar
- **Kluczowe funkcje**:
  - Collapsible sidebar (72px / 264px)
  - Navigation items (Dashboard, Team, Compare, Tips)
  - Bottom nav (Settings, Logout)
  - Top bar (mobile menu, notifications, avatar)
  - Mobile overlay
- **Rozbieżności**: React Router `useLocation()` → Next.js `usePathname()`

### Komponenty UI

#### KPICard
- **Lokalizacja**: `frontend/components/ui/KPICard.tsx` (już istnieje, do zaktualizowania)
- **Opis**: Karta KPI z trendem
- **Props**: `title`, `value`, `subtitle`, `icon`, `trend?`, `className?`
- **Styling**: rounded-2xl, shadow-soft, hover:shadow-elevated

#### DomainBadge
- **Lokalizacja**: `frontend/components/ui/DomainBadge.tsx` (już istnieje, do zaktualizowania)
- **Opis**: Badge koloru domeny Gallup
- **Props**: `domain`, `size?`, `showLabel?`, `className?`
- **Domeny**: executing (purple), influencing (orange), relationship (teal), strategic (blue)

#### DomainChart
- **Lokalizacja**: `frontend/components/dashboard/DomainChart.tsx` (już istnieje, do zaktualizowania)
- **Opis**: Wykres kołowy rozkładu domen
- **Props**: `distribution`
- **Implementacja**: Recharts PieChart z custom colors

#### TeamMemberCard
- **Lokalizacja**: `frontend/components/dashboard/TeamMemberCard.tsx` (nowy)
- **Opis**: Karta członka zespołu
- **Props**: `member`, `onClick?`, `isSelected?`, `compact?`, `className?`
- **Warianty**: normal (grid), compact (compare)
- **Kluczowe elementy**: avatar, name, role, top 3 talents, manager badge

### Komponenty Feature

#### TalentImport (Dialog + PDF + Manual)
- **Lokalizacja**: `frontend/components/talent-import/`
- **Pliki**:
  - `TalentImportDialog.tsx` - Dialog wrapper
  - `PdfTalentImport.tsx` - PDF upload & parsing
  - `ManualTalentInput.tsx` - Manual selection z dropdowns
- **Wyzwania**: Integracja z backend `/api/gallup/parse-pdf`

---

## Design System Migration

### Tailwind CSS v4 Updates

#### Custom Colors (CSS Variables)
```css
/* Domain Colors */
--domain-executing: 262 60% 50%;          /* Purple/Indigo */
--domain-influencing: 25 95% 53%;         /* Orange/Amber */
--domain-relationship: 168 70% 40%;        /* Teal/Green */
--domain-strategic: 210 80% 50%;          /* Blue */

/* Light Variants */
--domain-executing-light: 262 60% 95%;
--domain-influencing-light: 25 95% 95%;
--domain-relationship-light: 168 70% 94%;
--domain-strategic-light: 210 80% 95%;

/* Gradients */
--gradient-primary: linear-gradient(135deg, hsl(220 70% 45%), hsl(250 60% 55%));
--gradient-warm: linear-gradient(135deg, hsl(15 85% 55%), hsl(35 90% 55%));
--gradient-hero: linear-gradient(160deg, hsl(220 25% 10%) 0%, hsl(220 40% 20%) 100%);

/* Sidebar Colors */
--sidebar-background: 220 25% 10%;
--sidebar-foreground: 210 20% 90%;
--sidebar-primary: 220 70% 55%;
--sidebar-accent: 220 30% 18%;
```

#### Custom Utilities
```css
/* Typography */
.text-display { /* H1 - Space Grotesk */ }
.text-headline { /* H2 */ }
.text-title { /* H3 */ }
.text-body-lg { /* Body large */ }
.text-body { /* Body */ }
.text-label { /* Labels */ }

/* Badges */
.domain-executing { /* Purple background */ }
.domain-influencing { /* Orange background */ }
.domain-relationship { /* Teal background */ }
.domain-strategic { /* Blue background */ }

/* Effects */
.shadow-soft { /* Subtle shadow */ }
.shadow-elevated { /* Stronger shadow */ }
.shadow-glow { /* Glow effect */ }

.glass { /* Glass morphism */ }
```

#### Custom Shadows
```css
--shadow-sm: 0 1px 2px 0 hsl(220 25% 10% / 0.05);
--shadow-md: 0 4px 6px -1px hsl(220 25% 10% / 0.07), 0 2px 4px -1px hsl(220 25% 10% / 0.05);
--shadow-lg: 0 10px 25px -5px hsl(220 25% 10% / 0.1), 0 8px 10px -6px hsl(220 25% 10% / 0.05);
--shadow-xl: 0 20px 40px -10px hsl(220 25% 10% / 0.15);
--shadow-glow: 0 0 40px -10px hsl(220 70% 45% / 0.3);
```

#### Custom Animations
```css
.animate-fade-in { /* 0.5s ease-out */ }
.animate-slide-up { /* 0.5s ease-out */ }
.animate-slide-in-right { /* 0.4s ease-out */ }
.animate-scale-in { /* 0.3s ease-out */ }
.animate-pulse-soft { /* 2s ease-in-out infinite */ }
```

---

## Data Migration

### Types & Interfaces

#### GallupTalent
```typescript
interface GallupTalent {
  id: string;          // e.g., "achiever"
  name: string;        // e.g., "Achiever"
  namePl: string;      // e.g., "Osiąganie"
  domain: GallupDomain;
  description: string;
  descriptionPl: string;
}
```

#### TeamMember
```typescript
interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  talents: UserTalent[];
  topTalents: string[]; // Top 5-10 talent IDs
  strengths: string[];
  triggers: string[];
  blockers: string[];
  feedbackGuidance: string;
}
```

#### DailyTip
```typescript
interface DailyTip {
  id: string;
  title: string;
  content: string;
  category: 'communication' | 'collaboration' | 'development' | 'leadership';
  targetDomain?: GallupDomain;
  isHelpful?: boolean | null;
}
```

### Mock Data → Real API

#### API Endpoints
- `GET /api/users` - List team members
- `GET /api/users/:id` - Get user details
- `GET /api/users/:id/talents` - Get user talents
- `POST /api/users/:id/talents` - Update user talents
- `POST /api/gallup/parse-pdf` - Parse Gallup PDF
- `GET /api/tips/daily` - Get daily tip
- `POST /api/tips/:id/feedback` - Submit tip feedback
- `GET /api/teams/:id/members` - Get team members
- `POST /api/compare` - Compare two users

---

## Plan Implementacji

### Faza 1: Fundamenty Design System (1-2 dni)

#### Task 1.1: Aktualizacja Tailwind Config
- [ ] Dodanie custom colors do Tailwind v4
- [ ] Dodanie custom shadows
- [ ] Dodanie custom animations
- [ ] Dodanie custom utilities (typografia, badged, efekty)

#### Task 1.2: Aktualizacja Global CSS
- [ ] Import custom fonts (Inter + Space Grotesk)
- [ ] Definicja CSS variables dla colors
- [ ] Definicja CSS utilities
- [ ] Dark mode support

**Pliki do edycji**:
- `frontend/tailwind.config.ts` (lub `tailwind.config.js` w v4)
- `frontend/app/globals.css`

**Ryzyka**:
- Tailwind v4 ma inne API niż v3
- Konflikty z istniejącymi stylami

---

### Faza 2: Komponenty UI (2-3 dni)

#### Task 2.1: Aktualizacja istniejących komponentów
- [ ] `KPICard.tsx` - nowy styling, props `subtitle` zamiast `description`
- [ ] `DomainBadge.tsx` - dodanie props `showLabel`, nowe colors
- [ ] `DomainChart.tsx` - aktualizacja colors, nowe typy

#### Task 2.2: Nowe komponenty
- [ ] `SidebarLayout.tsx` - główny layout z sidebar
- [ ] `TeamMemberCard.tsx` - karta członka zespołu (2 warianty)
- [ ] `SettingsSection.tsx` - sekcja ustawień

**Pliki do stworzenia/zaktualizować**:
- `frontend/components/ui/KPICard.tsx`
- `frontend/components/ui/DomainBadge.tsx`
- `frontend/components/dashboard/DomainChart.tsx`
- `frontend/components/dashboard/SidebarLayout.tsx` (NOWY)
- `frontend/components/dashboard/TeamMemberCard.tsx` (NOWY)
- `frontend/components/dashboard/SettingsSection.tsx` (NOWY)

**Ryzyka**:
- Zgodność z Tailwind v4
- TypeScript types

---

### Faza 3: Strony Publiczne (1-2 dni)

#### Task 3.1: Landing Page
- [ ] Hero section z gradientem i animations
- [ ] Domains section (4 cards)
- [ ] Features section (6 cards)
- [ ] CTA section
- [ ] Footer

#### Task 3.2: Auth Page
- [ ] Login form
- [ ] Register form
- [ ] Reset password form
- [ ] Integration z backend auth API

**Pliki do stworzenia/zaktualizować**:
- `frontend/app/page.tsx` (Landing Page)
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/register/page.tsx`

**Ryzyka**:
- Form validation
- Error handling
- Integration z backend API

---

### Faza 4: Strony Dashboard (3-4 dni)

#### Task 4.1: Dashboard Page
- [ ] KPI cards z real data
- [ ] Domain chart z API
- [ ] Daily tip card z API
- [ ] Team member grid (4 members)

#### Task 4.2: Team Page
- [ ] Search i filters
- [ ] Team member grid
- [ ] Team member detail page `[id]`

#### Task 4.3: Compare Page
- [ ] Selection mode (2 osoby)
- [ ] Results view
- [ ] Bridges/Barriers logic
- [ ] Tips generation

**Pliki do stworzenia/zaktualizować**:
- `frontend/app/(dashboard)/dashboard/page.tsx`
- `frontend/app/(dashboard)/team/page.tsx`
- `frontend/app/(dashboard)/team/[id]/page.tsx` (NOWY)
- `frontend/app/(dashboard)/compare/page.tsx` (NOWY)

**Ryzyka**:
- Data fetching
- Error states
- Loading states
- TypeScript types

---

### Faza 5: Strony Tips & Settings (2-3 dni)

#### Task 5.1: Tips Page
- [ ] Main tip card
- [ ] Feedback system
- [ ] Navigation (prev/next)
- [ ] Tips history

#### Task 5.2: Settings Page
- [ ] Organization settings
- [ ] Talent import dialog
- [ ] Team management
- [ ] Notifications
- [ ] Privacy & Security

**Pliki do stworzenia/zaktualizować**:
- `frontend/app/(dashboard)/tips/page.tsx` (NOWY)
- `frontend/app/(dashboard)/settings/page.tsx` (NOWY)

**Ryzyka**:
- Talent import PDF parsing
- Complex forms
- State management

---

### Faza 6: Feature Components (2-3 dni)

#### Task 6.1: Talent Import Dialog
- [ ] Dialog wrapper
- [ ] PDF upload & parsing
- [ ] Manual talent input
- [ ] Integration z backend API

**Pliki do stworzenia**:
- `frontend/components/talent-import/TalentImportDialog.tsx` (NOWY)
- `frontend/components/talent-import/PdfTalentImport.tsx` (NOWY)
- `frontend/components/talent-import/ManualTalentInput.tsx` (NOWY)

**Ryzyka**:
- PDF parsing integration
- Complex form state
- Error handling

---

## Wyzwania Techniczne

### 1. React Router → Next.js App Router
- **Problem**: `Link` z react-router-dom vs Next.js `Link`
- **Rozwiązanie**: Replace所有 `<Link>` z `react-router-dom` na `next/link`
- **Narzędzia**: Find & Replace w VS Code

### 2. State Management
- **Problem**: React Router `useLocation()` nie działa w Next.js
- **Rozwiązanie**: Użycie `usePathname()` z `next/navigation`
- **Lokalizacje**: SidebarLayout, NavLink components

### 3. Client Components
- **Problem**: Next.js Server Components by default
- **Rozwiązanie**: Dodaj `"use client"` na top of pages/components z hooks/interactivity
- **Które pliki**: Wszystkie pages z useState, useEffect, event handlers

### 4. API Integration
- **Problem**: Mock data vs real API
- **Rozwiązanie**: Create API client w `frontend/lib/api.ts`
- **Narzędzia**: Axios lub fetch z proper error handling

### 5. Tailwind v4 Migration
- **Problem**: Tailwind v4 ma inne API niż v3
- **Rozwiązanie**: Przeczytaj Tailwind v4 docs, zaktualizuj config
- **Ryzyka**: Breaking changes w custom utilities

---

## Checklista przed uruchomieniem

### Frontend
- [ ] Wszystkie strony renderują się bez errors
- [ ] Wszystkie komponenty są responsywne
- [ ] Wszystkie formy walidują się poprawnie
- [ ] Error handling działa (404, 500, API errors)
- [ ] Loading states są widoczne
- [ ] Animacje działają płynnie
- [ ] Dark mode support (jeśli wymagane)
- [ ] Accessibility (ARIA labels, keyboard navigation)

### Backend Integration
- [ ] API endpointy są zdefiniowane
- [ ] Authentication/authorization działa
- [ ] Data fetching errors są handled
- [ ] PDF upload works
- [ ] Database queries są optimized

### Testing
- [ ] Manual QA wszystkich stron
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile testing (iOS Safari, Chrome Mobile)
- [ ] Performance testing (Lighthouse score)

---

## Wskazówki Implementacyjne

### 1. Podejście Incrementalne
- Implementuj jedna stronę na raz
- Start z Landing Page (najprostsza)
- Koncz z Settings/Tips Page (najtrudniejsze)

### 2. Reuse Components
- Nie kopiuj ad-hoc - reuse istniejące komponenty
- Zidentyfikuj "źródło prawdy" dla stylów
- Extract reusable patterns early

### 3. Error Boundaries
- Dodaj error boundaries dla critical routes
- Handle API errors gracefully
- Show user-friendly error messages

### 4. Performance
- Lazy load heavy components (Charts)
- Optimize images
- Code splitting where appropriate

### 5. Testing Strategy
- Test lokalnie przed commit
- Use React DevTools for debugging
- Check Console for errors

---

## Timeline Estimate

| Faza | Opis | Czas (dni) | Priorytet |
|------|------|-----------|-----------|
| Faza 1 | Fundamenty Design System | 1-2 | HIGH |
| Faza 2 | Komponenty UI | 2-3 | HIGH |
| Faza 3 | Strony Publiczne | 1-2 | MEDIUM |
| Faza 4 | Strony Dashboard | 3-4 | HIGH |
| Faza 5 | Tips & Settings | 2-3 | MEDIUM |
| Faza 6 | Feature Components | 2-3 | HIGH |
| **Razem** | | **11-17 dni** | |

---

## Risks & Mitigation

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitigation |
|--------|------------------|-------|------------|
| Tailwind v4 breaking changes | Medium | High | Dokładnie przetestuj custom utilities |
| API integration issues | High | High | Mock data fallback, error boundaries |
| Time overrun | Medium | Medium | Prioritize core features, defer nice-to-haves |
| Performance issues | Low | Medium | Lazy loading, optimization |
| Browser compatibility | Low | Low | Test on major browsers |

---

## Post-Migration Checklist

- [ ] Wszystkie strony z talent-navigator są zaimplementowane
- [ ] Design system jest consistent
- [ ] Responsywność działa na wszystkich breakpointach
- [ ] API integration działa poprawnie
- [ ] Error handling jest zaimplementowane
- [ ] Loading states są widoczne
- [ ] Animacje działają płynnie
- [ ] Accessibility standards są spełnione
- [ ] Performance metrics są dobre (Lighthouse > 90)
- [ ] Documentation jest aktualna

---

## Dokumentacja

- Talent-Navigator source: `../talent-navigator`
- TalentPilot project: `./`
- Design System docs: `frontend/app/globals.css`
- API docs: `backend/main.py`, `backend/routers/`

---

## Kontakty & Support

- Pytania techniczne: Zobacz AGENTS.md
- Code review: Uruchom `npm run lint`
- Issues: Raportuj w GitHub Issues

---

**Status dokumentu**: Wersja 1.0
**Ostatnia aktualizacja**: 2025-01-16
**Autor**: AI Agent
