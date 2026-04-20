# Queue System

Electronic queue management system for **NDPI Registrator ofisi** (Nukus State Pedagogical Institute — Registrar's Office).

Design: [`docs/superpowers/specs/2026-04-20-queue-system-design.md`](docs/superpowers/specs/2026-04-20-queue-system-design.md)

## Status

- ✅ Phase 0 — monorepo skeleton, 65-service fixture
- ✅ Phase 1 — kiosk frontend on mocks
- ⏳ Phase 2 — Go agent + Xprinter XP-80T
- ⏳ Phase 3 — admin on mocks
- ⏳ Phase 4 — operator console on mocks
- ⏳ Phase 5 — display (табло) on mocks
- ⏳ Phase 6 — Django 6 API (replace mocks)
- ⏳ Phase 7 — realtime (Channels + Redis)
- ⏳ Phase 8 — deploy

## Structure

```
apps/
  kiosk/       # touch-screen kiosk (Next.js 15, built)
  admin/       # admin panel (planned)
  operator/    # operator console (planned)
  display/     # waiting-hall display (planned)
packages/
  types/       # shared TS types
  mocks/       # MSW handlers + fixture (65 services, 9 categories)
backend/       # Django 6 API (planned)
agent/         # Go local agent (planned)
```

## Prerequisites

- Node.js 20+ and pnpm 9+
- (Phase 2+) Go 1.22+
- (Phase 6+) Python 3.12, Poetry, PostgreSQL 16, Redis 7

## Quick start

```bash
pnpm install
pnpm --filter @queue/kiosk dev   # http://localhost:3001
```

Default locale is `kaa` (Karakalpak). Switch to `ru` via the top-right button.

## Scripts

```bash
pnpm dev               # all apps in parallel (Turborepo)
pnpm build             # production builds
pnpm lint              # lint all packages
pnpm typecheck         # typecheck all packages
pnpm test              # unit tests
pnpm --filter @queue/kiosk test:e2e   # Playwright happy path
pnpm format            # prettier
```

## Kiosk flow

1. Main screen: 9 category cards (colour-coded A–I)
2. Pick a category → list of services in that category
3. Pick a service (online-only are shown disabled with "HEMIS" hint)
4. Confirm → mock `POST /api/tickets` (MSW) + mock print → ticket screen
5. Ticket screen shows big number (e.g. `A042`) with counter-direction prompt
6. 30 s of inactivity on any non-home screen → auto-return to home
