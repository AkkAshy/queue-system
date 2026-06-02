# Phase 5 — Waiting-Hall Display (Табло) Implementation Plan

> Written from `docs/superpowers/specs/2026-04-20-queue-system-design.md` §8 (phase 5), §6 (data model), §7 (real-time / events). Executed task-by-task with atomic commits and TDD on the mocks layer.

**Goal:** Ship a fullscreen Next.js app at `apps/display` (port 3004) for a TV in the waiting hall: shows the latest call as a big animated hero (`A013 → Окно 1`), a grid of other active calls, a running ticker (бегущая строка), and a chime on each new call. MSW-backed, polling every 2 s. No interactivity except a mute toggle.

**Architecture:** A fourth Next.js 15 app reusing the shared `tailwind.preset.js` + JetBrains Mono + MSW handlers. Landscape fullscreen (16:9 TV), dark "paper on charcoal" palette. Data: TanStack Query polling `GET /api/display/active` (active calls joined with counter labels) + `GET /api/counters`, every 2 s. A new `DisplayCall` type carries the joined shape. The mocks layer gains `TicketStore.activeCalls()` + `TicketStore.seedCalled()` and a `display-seed.json` so the board is populated on first load. The chime is a small WebAudio beep fired when a call id appears that wasn't there last tick; a mute toggle persists in `localStorage`.

**Tech Stack:** Next.js 15 App Router, React 19 RC, TS strict, Tailwind + minimal shadcn (Button only, for mute), TanStack Query 5 `refetchInterval`, MSW 2, Vitest + Playwright. No Zustand (display is read-only; mute lives in a tiny `useState` + localStorage).

---

## Decisions (from spec defaults)

- **5 windows, categories merged.** Reuses the existing `counters.json` (Okno 1–5).
- **Display listens to all counters** (single board for the hall), not one per window.
- **Sound = WebAudio chime**, not WAV number samples (those are Phase 6+). Mute toggle, persisted.
- **Polling 2 s** on mocks. Phase 7 swaps to Channels (`display:<counter_id>` events).
- **"Active call" = ticket with status `called` or `serving`.** Newest `called_at` first; the freshest is the hero.
- **Seed 3 active calls** so the board isn't empty before an operator calls anyone.

---

## File Map

```
queue-system/
├── packages/types/src/index.ts                 # + DisplayCall
├── packages/mocks/
│   ├── src/
│   │   ├── ticket-store.ts                      # + activeCalls() + seedCalled()
│   │   ├── fixtures/display-seed.json           # NEW — 3 called tickets
│   │   ├── handlers.ts                          # + GET /api/display/active, wire seedCalled
│   │   └── index.ts                             # + export display-seed
│   └── tests/ticket-store.test.ts               # EXTENDED — activeCalls/seedCalled
│
└── apps/display/                                # NEW APP (port 3004)
    ├── package.json / tsconfig / next.config.mjs / postcss / tailwind / components.json / .eslintrc.json
    ├── public/mockServiceWorker.js
    ├── app/{layout,globals.css,providers,page}.tsx
    ├── components/{Hero,CallsGrid,Ticker,DisplayClock,MuteButton}.tsx
    ├── lib/{utils,msw,query-client,api,useChime}.ts(x)
    ├── components/ui/button.tsx
    ├── playwright.config.ts
    ├── tests/e2e/display-smoke.spec.ts
    └── README.md
```

---

## Tasks

### Task 1 — types: `DisplayCall`
Append to `packages/types/src/index.ts`:
```ts
export interface DisplayCall {
  id: string;            // ticket id
  number: string;        // 'A013'
  category_id: number;
  counter_id: number;
  counter_number: string; // '1'
  counter_name: string;   // 'Okno 1 — …'
  called_at: string;      // ISO
  status: 'called' | 'serving';
}
```
Typecheck `@queue/types`. Commit.

### Task 2 — `TicketStore.activeCalls()` + `seedCalled()` (TDD)
- `activeCalls(): Ticket[]` — tickets with status `called` or `serving`, sorted by `called_at` DESC (nulls last).
- `seedCalled(items: { number; category_id; service_id; counter_id; operator_id; called_at }[]): void` — inserts tickets with status `called`.
- Extend `tests/ticket-store.test.ts`: seedCalled → activeCalls returns them newest-first; callNext result also appears in activeCalls; finish removes from activeCalls.
- Run (red→green). Commit.

### Task 3 — display seed + MSW endpoint
- `fixtures/display-seed.json`: 3 called tickets across counters 1/3/5 with staggered `called_at`.
- `handlers.ts`: after the waiting seed, `tickets.seedCalled(displaySeed…)`; add
  `GET /api/display/active` → map `tickets.activeCalls()` to `DisplayCall[]` by joining `counters.get(counter_id)` (skip calls whose counter is unknown/missing counter_id). Cap 12.
- `index.ts`: export display-seed.
- Typecheck + test mocks. Commit.

### Task 4 — bootstrap `apps/display` (port 3004)
Mirror `apps/operator` configs, swap port→3004 and title. Landscape fullscreen body (no `overflow:hidden` widget constraint — it's a TV, `h-screen w-screen`). Stub `page.tsx`. `pnpm install`, smoke `curl :3004` = 200, typecheck. Commit.

### Task 5 — shadcn Button + Providers + MSW + api + query-client
Copy `button.tsx` from operator. `msw:init`. Create `lib/{query-client,msw,api}.ts` (api: `getActiveCalls()`, `listCounters()`), `app/providers.tsx` (QueryClientProvider + MSW boot, no Toaster needed), wire into layout. Typecheck. Commit.

### Task 6 — components + chime
- `DisplayClock.tsx` — live HH:MM + date (client clock, same approach as kiosk Clock).
- `useChime.ts` — WebAudio beep; `playChime(muted)`.
- `Hero.tsx` — the freshest call: huge number + "→ Окно N", category color accent, enter animation.
- `CallsGrid.tsx` — the rest of active calls as cards (number → window).
- `Ticker.tsx` — bottom marquee with rolling info line(s).
- `MuteButton.tsx` — toggle, persists to localStorage.
Typecheck. Commit.

### Task 7 — page assembly + visual verify
`page.tsx`: poll `getActiveCalls` (2 s) + counters; hero = calls[0], grid = calls.slice(1); fire chime when the set of call ids gains a new id vs the previous tick. Header with title + clock + mute. Ticker at the bottom. Verify live in browser (preview): board renders seeded calls; trigger a new call from the operator app (or via API) → hero updates + chime. Commit.

### Task 8 — Playwright e2e smoke
Load `/`, expect a called number (`/^[A-Z]\d{3}$/`) and a "Окно" label visible. webServer `pnpm dev` on 3004. Run. Commit.

### Task 9 — final verification + root README
`pnpm typecheck` (6 pkgs), `pnpm test`, all e2e suites, `go test`. Mark Phase 5 ✅ in README, add display to structure + quick start. Commit.

---

## Verification Checklist
- [ ] `pnpm typecheck` clean across 6 packages.
- [ ] `pnpm test` PASS (mocks gains activeCalls/seedCalled tests).
- [ ] Board on `:3004` shows seeded active calls; hero = freshest.
- [ ] Operator calls a ticket → it appears as the hero within ~2 s + chime fires (unless muted).
- [ ] Ticker scrolls; clock ticks; mute toggle persists across reload.
- [ ] All e2e suites (kiosk, admin, operator, display) PASS.

## Open Questions for Phase 6+
- **Real-time.** Poll → Channels `display:<counter_id>`; call events push instantly (<1 s p95 target).
- **Voice announcements.** WAV number samples ("Nómer A nol bir úsh, úshinshi aynа") fired alongside the chime.
- **Per-window boards.** A second layout that filters to one counter for a window-side mini-display.
- **Recall / blink.** When an operator re-calls a skipped ticket, the hero should blink + re-chime.
