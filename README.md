# Queue System

Electronic queue management system for NDPI Registrator ofisi.

See `docs/superpowers/specs/2026-04-20-queue-system-design.md` for full design.

## Quick start

```bash
pnpm install
pnpm dev  # runs all apps
```

## Structure

- `apps/kiosk` — touch-screen kiosk for students (ticket issuing)
- `apps/admin` — admin panel (planned)
- `apps/operator` — operator console (planned)
- `apps/display` — waiting-hall display (planned)
- `packages/types` — shared TypeScript types
- `packages/mocks` — MSW handlers + fixtures
- `backend/` — Django 6 API (planned)
- `agent/` — Go local agent for printer/TTS (planned)
