# Phase 4 — Operator Mini-Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a ~360×560 Next.js widget at `apps/operator` that operators run in Chrome app-mode in the corner of their screen, with one main action ("Вызвать следующего") plus finish / skip / transfer / break controls, wired to MSW with realistic seeded queue data.

**Architecture:** A third Next.js 15 app that reuses the shared `tailwind.preset.js` + JetBrains Mono + MSW handlers. Single-page (no sidebar / topbar). State: Zustand (operator + counter + session_id) persisted in sessionStorage; queue data via TanStack Query polling every 3 s. New MSW handlers delegate to an extended TicketStore (adds `callNext` / `finish` / `skip` / `transfer` / `seedWaiting`) and a new OperatorSessionStore, both in `packages/mocks`. Shipped with a `launch.sh` that opens the widget via `chrome --app=http://…:3003 --window-size=360,560`.

**Tech Stack:** Next.js 15 App Router, React 19 (RC), TypeScript strict, Tailwind + shadcn/ui (Button, Badge, Select, Sheet, Dialog, Sonner), TanStack Query 5 with `refetchInterval`, Zustand + persist, MSW 2, Vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-04-20-queue-system-design.md` §8 (phase 4), §6 (data model — `Ticket`, `Counter`, `OperatorSession`).

---

## File Map

```
queue-system/
├── packages/types/src/index.ts                     # + OperatorSession, + Ticket.operator_id/called_at
├── packages/mocks/
│   ├── src/
│   │   ├── ticket-store.ts                         # EXTENDED: list/get/update + callNext/finish/skip/transfer/seedWaiting
│   │   ├── operator-session-store.ts               # NEW
│   │   ├── fixtures/queue-seed.json                # NEW — 12 waiting tickets
│   │   └── handlers.ts                             # + operator endpoints
│   └── tests/
│       ├── ticket-store.test.ts                    # EXTENDED
│       └── operator-session-store.test.ts          # NEW
│
└── apps/operator/                                   # NEW APP
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── postcss.config.js
    ├── tailwind.config.ts
    ├── components.json
    ├── vitest.config.ts
    ├── playwright.config.ts
    ├── .eslintrc.json
    ├── public/mockServiceWorker.js
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── providers.tsx
    │   └── page.tsx                                # single-page: LoginScreen OR widget
    ├── components/
    │   ├── ui/                                     # shadcn
    │   ├── LoginScreen.tsx
    │   ├── CurrentTicket.tsx
    │   ├── CallNextButton.tsx
    │   ├── QueueList.tsx
    │   ├── OperatorFooter.tsx
    │   └── TransferSheet.tsx
    ├── lib/
    │   ├── utils.ts
    │   ├── msw.ts
    │   ├── query-client.ts
    │   └── api.ts                                  # typed fetch wrappers
    ├── store/operator-store.ts
    ├── scripts/launch.sh                           # Chrome app-mode launcher
    ├── tests/
    │   ├── operator-store.test.ts
    │   └── e2e/widget-smoke.spec.ts
    └── README.md
```

---

## Known Constraints & Decisions

- **Dev login is a dropdown, not a password form.** The admin panel owns real user management; the operator widget just picks from the seeded operators + counters to start a session. For production this becomes a token-based login — same shape, different handler.
- **Widget is 360×560.** That's the Chrome `--window-size` we ship. All components use small paddings (`p-3 / p-4`), large monospace numerals, minimal chrome. Tailwind `text-4xl` is as big as anything gets.
- **Polling, not WebSocket.** Phase 5 upgrades the queue + current-ticket reads to Channels. For now, TanStack Query polls every 3 s — cheap at mock scale.
- **Ticket fields.** We add `operator_id: number | null` and `called_at: string | null` to `Ticket`. The kiosk and admin already handle `counter_id: null`; an extra nullable field is safe.
- **Queue fairness is per-counter and FIFO.** Across a counter's eligible services, the oldest `waiting` ticket wins. No priorities (VIP, disability) — parked until Phase 6+.

---

### Task 1: Extend `packages/types` for operators

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Read current types file**

```bash
cat /Users/akkanat/Projects/queue-system/packages/types/src/index.ts | head -60
```

- [ ] **Step 2: Add `operator_id` + `called_at` to `Ticket` in-place**

Find the existing `Ticket` interface and replace with:

```ts
export interface Ticket {
  id: string;           // uuid
  number: string;       // 'A042'
  category_id: number;
  service_id: number | null;
  status: TicketStatus;
  counter_id: number | null;
  operator_id: number | null;   // who's currently serving (null while waiting)
  created_at: string;           // ISO
  called_at: string | null;     // ISO — set when status becomes 'called'
}
```

- [ ] **Step 3: Append the new operator types at the bottom of the file**

```ts

// -------- Phase 4 additions --------

export type OperatorSessionStatus = 'active' | 'break' | 'ended';

export interface OperatorSession {
  id: number;
  user_id: number;
  counter_id: number;
  status: OperatorSessionStatus;
  started_at: string;       // ISO
  ended_at: string | null;  // ISO
}

export interface CreateOperatorSessionRequest {
  user_id: number;
  counter_id: number;
}

export interface CallNextRequest {
  counter_id: number;
  operator_id: number;
}

export interface TransferTicketRequest {
  counter_id: number;
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/types typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add OperatorSession, extend Ticket with operator_id + called_at"
```

---

### Task 2: Extend `TicketStore` with list / update / callNext / finish / skip / transfer / seedWaiting

**Files:**
- Modify: `packages/mocks/src/ticket-store.ts`
- Modify: `packages/mocks/tests/handlers.test.ts` (will likely need a minor update since Ticket shape changed)
- Create: `packages/mocks/tests/ticket-store.test.ts`

- [ ] **Step 1: Write failing test — `packages/mocks/tests/ticket-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TicketStore } from '../src/ticket-store';

function makeStore() {
  const s = new TicketStore();
  // Seed 5 waiting tickets with deterministic timestamps + service assignments.
  // oldest → newest: t1 (service 1), t2 (service 5), t3 (service 1), t4 (service 9), t5 (service 5)
  s.seedWaiting([
    { number: 'A001', category_id: 1, service_id: 1, created_at: '2026-04-20T09:00:00Z' },
    { number: 'E001', category_id: 5, service_id: 5, created_at: '2026-04-20T09:05:00Z' },
    { number: 'A002', category_id: 1, service_id: 1, created_at: '2026-04-20T09:10:00Z' },
    { number: 'I001', category_id: 9, service_id: 9, created_at: '2026-04-20T09:15:00Z' },
    { number: 'E002', category_id: 5, service_id: 5, created_at: '2026-04-20T09:20:00Z' },
  ]);
  return s;
}

describe('TicketStore — query + transitions', () => {
  let store: TicketStore;
  beforeEach(() => {
    store = makeStore();
  });

  it('list returns all seeded tickets', () => {
    expect(store.list()).toHaveLength(5);
  });

  it('callNext picks oldest waiting ticket whose service is eligible', () => {
    const t = store.callNext({
      counter_id: 3,
      operator_id: 2,
      service_ids: [5, 9], // eligible services for this counter
    });
    expect(t).not.toBeNull();
    expect(t!.number).toBe('E001'); // oldest among services 5 + 9 is E001
    expect(t!.status).toBe('called');
    expect(t!.counter_id).toBe(3);
    expect(t!.operator_id).toBe(2);
    expect(t!.called_at).not.toBeNull();
  });

  it('callNext returns null when no eligible waiting ticket exists', () => {
    const t = store.callNext({
      counter_id: 7,
      operator_id: 9,
      service_ids: [999], // unknown service
    });
    expect(t).toBeNull();
  });

  it('callNext does not pick a ticket already called', () => {
    store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] }); // E001
    const second = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] });
    expect(second!.number).toBe('E002'); // next oldest in service 5
  });

  it('finish transitions called → served', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const done = store.finish(called.id)!;
    expect(done.status).toBe('served');
  });

  it('skip transitions called → skipped', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const skipped = store.skip(called.id)!;
    expect(skipped.status).toBe('skipped');
  });

  it('transfer reassigns counter and resets to waiting', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const moved = store.transfer(called.id, 4)!;
    expect(moved.counter_id).toBe(4);
    expect(moved.status).toBe('waiting');
    expect(moved.operator_id).toBeNull();
    expect(moved.called_at).toBeNull();
  });

  it('currentForCounter returns the called/serving ticket of that counter', () => {
    store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] });
    const cur = store.currentForCounter(3);
    expect(cur?.number).toBe('E001');
    expect(store.currentForCounter(99)).toBeNull();
  });

  it('queueForCounter returns waiting tickets of eligible services, oldest first', () => {
    const q = store.queueForCounter([5, 9]);
    expect(q.map((t) => t.number)).toEqual(['E001', 'I001', 'E002']);
    expect(q.every((t) => t.status === 'waiting')).toBe(true);
  });

  it('create still works (idempotency preserved from Phase 1)', () => {
    const a = store.create({ category_id: 1, code: 'A', idempotency_key: 'k1' });
    const b = store.create({ category_id: 1, code: 'A', idempotency_key: 'k1' });
    expect(a.id).toBe(b.id);
    expect(store.list()).toHaveLength(6); // 5 seeded + 1 created
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
cd /Users/akkanat/Projects/queue-system/packages/mocks
pnpm test -- ticket-store
```

Expected: FAIL with "seedWaiting is not a function" (and friends).

- [ ] **Step 3: Replace `packages/mocks/src/ticket-store.ts` with the extended version**

```ts
import type { Ticket } from '@queue/types';

interface CreateArgs {
  category_id: number;
  code: string;          // 'A', 'B', etc.
  service_id?: number;
  idempotency_key: string;
}

interface CallNextArgs {
  counter_id: number;
  operator_id: number;
  service_ids: number[];
}

interface SeedArgs {
  number: string;
  category_id: number;
  service_id: number;
  created_at: string;    // ISO
}

export class TicketStore {
  private counters = new Map<string, number>();        // prefix → last number
  private byKey = new Map<string, Ticket>();           // idempotency_key → ticket (kept for Phase 1 compat)
  private byId = new Map<string, Ticket>();            // id → ticket (primary index)

  // -------- Phase 1: create (unchanged behaviour) --------

  create(args: CreateArgs): Ticket {
    const cached = this.byKey.get(args.idempotency_key);
    if (cached) return { ...cached };

    const last = this.counters.get(args.code) ?? 0;
    const next = last + 1;
    this.counters.set(args.code, next);

    const number = `${args.code}${next.toString().padStart(3, '0')}`;
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      number,
      category_id: args.category_id,
      service_id: args.service_id ?? null,
      status: 'waiting',
      counter_id: null,
      operator_id: null,
      created_at: new Date().toISOString(),
      called_at: null,
    };
    this.byKey.set(args.idempotency_key, ticket);
    this.byId.set(ticket.id, ticket);
    return { ...ticket };
  }

  // -------- Phase 4: queries --------

  list(): Ticket[] {
    return [...this.byId.values()].map((t) => ({ ...t }));
  }

  get(id: string): Ticket | undefined {
    const t = this.byId.get(id);
    return t ? { ...t } : undefined;
  }

  /** The called/serving ticket of a counter, or null. */
  currentForCounter(counterId: number): Ticket | null {
    const t = [...this.byId.values()].find(
      (x) =>
        x.counter_id === counterId && (x.status === 'called' || x.status === 'serving'),
    );
    return t ? { ...t } : null;
  }

  /** Waiting tickets whose service_id is eligible for this counter, oldest first. */
  queueForCounter(eligibleServiceIds: number[]): Ticket[] {
    const eligible = new Set(eligibleServiceIds);
    return [...this.byId.values()]
      .filter(
        (t) =>
          t.status === 'waiting' &&
          t.service_id !== null &&
          eligible.has(t.service_id),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((t) => ({ ...t }));
  }

  // -------- Phase 4: transitions --------

  callNext(args: CallNextArgs): Ticket | null {
    const q = this.queueForCounter(args.service_ids);
    if (q.length === 0) return null;
    const oldest = q[0]!;
    return this.update(oldest.id, {
      status: 'called',
      counter_id: args.counter_id,
      operator_id: args.operator_id,
      called_at: new Date().toISOString(),
    })!;
  }

  finish(id: string): Ticket | null {
    return this.update(id, { status: 'served' });
  }

  skip(id: string): Ticket | null {
    return this.update(id, { status: 'skipped' });
  }

  /** Transfer to a new counter; resets to waiting. */
  transfer(id: string, newCounterId: number): Ticket | null {
    return this.update(id, {
      status: 'waiting',
      counter_id: newCounterId,
      operator_id: null,
      called_at: null,
    });
  }

  // -------- Phase 4: seed + update primitive --------

  /** Load waiting tickets for demos. Overwrites nothing else. */
  seedWaiting(items: SeedArgs[]): void {
    for (const s of items) {
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        number: s.number,
        category_id: s.category_id,
        service_id: s.service_id,
        status: 'waiting',
        counter_id: null,
        operator_id: null,
        created_at: s.created_at,
        called_at: null,
      };
      this.byId.set(ticket.id, ticket);
    }
  }

  update(id: string, patch: Partial<Ticket>): Ticket | null {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated: Ticket = { ...existing, ...patch };
    this.byId.set(id, updated);
    return { ...updated };
  }

  reset() {
    this.counters.clear();
    this.byKey.clear();
    this.byId.clear();
  }
}
```

- [ ] **Step 4: Run tests — both ticket-store and existing handlers**

```bash
cd /Users/akkanat/Projects/queue-system/packages/mocks
pnpm test
```

Expected: `ticket-store.test.ts` all PASS; `handlers.test.ts` may fail on the old "returns the same ticket" test because `create` now returns a clone. If so, skip to step 5; otherwise skip to step 6.

- [ ] **Step 5: Fix `handlers.test.ts` if it broke**

The Phase 1 test called `first === second` — since we now return clones, the object references differ even though field values match. Change any strict-ref checks (`===`, `toBe`) for whole-ticket objects to `toEqual`. Open `packages/mocks/tests/handlers.test.ts` and grep for `toBe(` — replace object-level `toBe(first)` with `toEqual(first)`. Re-run tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add packages/mocks/src/ticket-store.ts packages/mocks/tests/
git commit -m "feat(mocks): extend TicketStore — queries, transitions, seed (tested)"
```

---

### Task 3: OperatorSessionStore with TDD

**Files:**
- Create: `packages/mocks/src/operator-session-store.ts`
- Create: `packages/mocks/tests/operator-session-store.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/mocks/tests/operator-session-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OperatorSessionStore } from '../src/operator-session-store';

describe('OperatorSessionStore', () => {
  let store: OperatorSessionStore;
  beforeEach(() => {
    store = new OperatorSessionStore();
  });

  it('create returns a new active session with ids and timestamp', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    expect(s.id).toBe(1);
    expect(s.user_id).toBe(2);
    expect(s.counter_id).toBe(1);
    expect(s.status).toBe('active');
    expect(s.started_at).toBeTruthy();
    expect(s.ended_at).toBeNull();
  });

  it('create auto-increments session id', () => {
    const a = store.create({ user_id: 2, counter_id: 1 });
    const b = store.create({ user_id: 3, counter_id: 2 });
    expect(b.id).toBe(a.id + 1);
  });

  it('updateStatus flips to break and back', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    const broken = store.updateStatus(s.id, 'break')!;
    expect(broken.status).toBe('break');
    const back = store.updateStatus(s.id, 'active')!;
    expect(back.status).toBe('active');
  });

  it('updateStatus to ended sets ended_at', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    const ended = store.updateStatus(s.id, 'ended')!;
    expect(ended.status).toBe('ended');
    expect(ended.ended_at).not.toBeNull();
  });

  it('updateStatus returns null for unknown id', () => {
    expect(store.updateStatus(999, 'break')).toBeNull();
  });

  it('activeForCounter returns the active session or null', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    expect(store.activeForCounter(1)?.id).toBe(s.id);
    store.updateStatus(s.id, 'ended');
    expect(store.activeForCounter(1)).toBeNull();
  });

  it('list returns all sessions', () => {
    store.create({ user_id: 2, counter_id: 1 });
    store.create({ user_id: 3, counter_id: 2 });
    expect(store.list()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
pnpm test -- operator-session-store
```

- [ ] **Step 3: Implement the store**

```ts
// packages/mocks/src/operator-session-store.ts
import type { OperatorSession, OperatorSessionStatus } from '@queue/types';

interface CreateArgs {
  user_id: number;
  counter_id: number;
}

export class OperatorSessionStore {
  private items: OperatorSession[] = [];
  private nextId = 1;

  create(args: CreateArgs): OperatorSession {
    const s: OperatorSession = {
      id: this.nextId++,
      user_id: args.user_id,
      counter_id: args.counter_id,
      status: 'active',
      started_at: new Date().toISOString(),
      ended_at: null,
    };
    this.items.push(s);
    return { ...s };
  }

  list(): OperatorSession[] {
    return this.items.map((s) => ({ ...s }));
  }

  get(id: number): OperatorSession | undefined {
    const s = this.items.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  /** Active (non-ended) session attached to a counter, if any. */
  activeForCounter(counterId: number): OperatorSession | null {
    const s = this.items.find(
      (x) => x.counter_id === counterId && x.status !== 'ended',
    );
    return s ? { ...s } : null;
  }

  updateStatus(id: number, status: OperatorSessionStatus): OperatorSession | null {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const existing = this.items[idx]!;
    const updated: OperatorSession = {
      ...existing,
      status,
      ended_at: status === 'ended' ? new Date().toISOString() : existing.ended_at,
    };
    this.items[idx] = updated;
    return { ...updated };
  }
}
```

- [ ] **Step 4: Run — verify 7 PASS**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add packages/mocks/src/operator-session-store.ts packages/mocks/tests/operator-session-store.test.ts
git commit -m "feat(mocks): OperatorSessionStore (tested)"
```

---

### Task 4: Waiting-queue seed fixture + wire into handlers

**Files:**
- Create: `packages/mocks/src/fixtures/queue-seed.json`
- Modify: `packages/mocks/src/handlers.ts` (call `seedWaiting` on startup)
- Modify: `packages/mocks/src/index.ts` (re-export new store)

- [ ] **Step 1: Create `packages/mocks/src/fixtures/queue-seed.json`**

12 waiting tickets, timestamps spread from `~25 min ago` backwards so the "waits N min" display has variation. Ticket numbers follow the same `{code}{NNN}` pattern the kiosk emits.

```json
[
  { "number": "A013", "category_id": 1, "service_id": 1,  "created_at": "2026-04-20T09:40:00Z" },
  { "number": "A014", "category_id": 1, "service_id": 2,  "created_at": "2026-04-20T09:45:00Z" },
  { "number": "B004", "category_id": 2, "service_id": 10, "created_at": "2026-04-20T09:50:00Z" },
  { "number": "E007", "category_id": 5, "service_id": 31, "created_at": "2026-04-20T09:52:00Z" },
  { "number": "A015", "category_id": 1, "service_id": 1,  "created_at": "2026-04-20T09:55:00Z" },
  { "number": "C004", "category_id": 3, "service_id": 21, "created_at": "2026-04-20T09:58:00Z" },
  { "number": "E008", "category_id": 5, "service_id": 33, "created_at": "2026-04-20T10:01:00Z" },
  { "number": "I002", "category_id": 9, "service_id": 61, "created_at": "2026-04-20T10:03:00Z" },
  { "number": "A016", "category_id": 1, "service_id": 9,  "created_at": "2026-04-20T10:06:00Z" },
  { "number": "G003", "category_id": 7, "service_id": 44, "created_at": "2026-04-20T10:08:00Z" },
  { "number": "E009", "category_id": 5, "service_id": 31, "created_at": "2026-04-20T10:11:00Z" },
  { "number": "A017", "category_id": 1, "service_id": 2,  "created_at": "2026-04-20T10:14:00Z" }
]
```

- [ ] **Step 2: Wire the seed and the session store into `packages/mocks/src/handlers.ts`**

Near the top of the file (under the other store imports) add:

```ts
import queueSeed from './fixtures/queue-seed.json';
import { OperatorSessionStore } from './operator-session-store';
```

Under the existing singleton declarations add:

```ts
const sessions = new OperatorSessionStore();

// Pre-populate the queue so operators have something to call in demos.
// Cast through unknown because JSON types look structurally compatible but
// TS can't infer this statically.
tickets.seedWaiting(queueSeed as unknown as Parameters<typeof tickets.seedWaiting>[0]);
```

- [ ] **Step 3: Re-export in `packages/mocks/src/index.ts`**

Add:

```ts
export { OperatorSessionStore } from './operator-session-store';
export { default as queueSeed } from './fixtures/queue-seed.json';
```

- [ ] **Step 4: Typecheck + tests**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/mocks typecheck
pnpm --filter @queue/mocks test
```

Expected: clean + all prior tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mocks/src/fixtures/queue-seed.json packages/mocks/src/handlers.ts packages/mocks/src/index.ts
git commit -m "feat(mocks): seed 12 waiting tickets + wire OperatorSessionStore"
```

---

### Task 5: MSW handlers for operator endpoints

**Files:**
- Modify: `packages/mocks/src/handlers.ts`

- [ ] **Step 1: Append the operator routes to `handlers.ts`**

Insert these handlers into the `export const handlers = [ ... ]` array (order doesn't matter). Need the `sessions`, `counters`, `tickets`, `users` singletons in scope — already declared at the top of the file from Phase 3.

```ts
  // ---------- operator sessions ----------
  http.post('/api/operator-sessions', async ({ request }) => {
    const body = (await request.json()) as { user_id: number; counter_id: number };
    const session = sessions.create(body);
    return HttpResponse.json(session, { status: 201 });
  }),

  http.patch('/api/operator-sessions/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { status: 'active' | 'break' | 'ended' };
    const updated = sessions.updateStatus(id, body.status);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  // ---------- queue + current ticket (per-counter) ----------
  http.get('/api/queue', ({ request }) => {
    const url = new URL(request.url);
    const counterId = Number(url.searchParams.get('counter_id'));
    const counter = counters.get(counterId);
    if (!counter) {
      return HttpResponse.json({ error: 'unknown counter' }, { status: 404 });
    }
    const q = tickets.queueForCounter(counter.service_ids);
    return HttpResponse.json(q.slice(0, 20)); // cap — widget only shows 5 anyway
  }),

  http.get('/api/tickets/current', ({ request }) => {
    const url = new URL(request.url);
    const counterId = Number(url.searchParams.get('counter_id'));
    return HttpResponse.json(tickets.currentForCounter(counterId));
  }),

  // ---------- ticket transitions ----------
  http.post('/api/tickets/call-next', async ({ request }) => {
    const body = (await request.json()) as { counter_id: number; operator_id: number };
    const counter = counters.get(body.counter_id);
    if (!counter) {
      return HttpResponse.json({ error: 'unknown counter' }, { status: 404 });
    }
    const t = tickets.callNext({
      counter_id: body.counter_id,
      operator_id: body.operator_id,
      service_ids: counter.service_ids,
    });
    if (!t) {
      return HttpResponse.json({ error: 'queue empty' }, { status: 409 });
    }
    return HttpResponse.json(t);
  }),

  http.post('/api/tickets/:id/finish', ({ params }) => {
    const t = tickets.finish(String(params.id));
    if (!t) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json(t);
  }),

  http.post('/api/tickets/:id/skip', ({ params }) => {
    const t = tickets.skip(String(params.id));
    if (!t) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json(t);
  }),

  http.post('/api/tickets/:id/transfer', async ({ params, request }) => {
    const body = (await request.json()) as { counter_id: number };
    const t = tickets.transfer(String(params.id), body.counter_id);
    if (!t) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json(t);
  }),
```

- [ ] **Step 2: Typecheck + tests**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/mocks typecheck
pnpm --filter @queue/mocks test
```

- [ ] **Step 3: Commit**

```bash
git add packages/mocks/src/handlers.ts
git commit -m "feat(mocks): add operator endpoints (sessions, queue, call/finish/skip/transfer)"
```

---

### Task 6: Bootstrap `apps/operator`

**Files:**
- Create: `apps/operator/package.json`
- Create: `apps/operator/tsconfig.json`
- Create: `apps/operator/next.config.mjs`
- Create: `apps/operator/postcss.config.js`
- Create: `apps/operator/tailwind.config.ts`
- Create: `apps/operator/components.json`
- Create: `apps/operator/.eslintrc.json`
- Create: `apps/operator/app/globals.css`
- Create: `apps/operator/app/layout.tsx`
- Create: `apps/operator/app/page.tsx` (stub)
- Create: `apps/operator/lib/utils.ts`

Use `apps/admin` as the reference — just swap the port (3003) and the title. Trim what's not needed (no next-intl, no middleware).

- [ ] **Step 1: Create `apps/operator/package.json`**

```json
{
  "name": "@queue/operator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3003",
    "build": "next build",
    "start": "next start -p 3003",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "msw:init": "msw init public/ --save"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0-rc.1",
    "react-dom": "19.0.0-rc.1",
    "@tanstack/react-query": "^5.59.0",
    "zustand": "^5.0.0",
    "msw": "^2.6.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.451.0",
    "sonner": "^1.5.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@queue/types": "workspace:*",
    "@queue/mocks": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "npm:types-react@rc",
    "@types/react-dom": "npm:types-react-dom@rc",
    "typescript": "^5.6.3",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "tailwindcss-animate": "^1.0.7",
    "eslint": "^8.57.1",
    "eslint-config-next": "15.0.0",
    "vitest": "^2.1.1",
    "@vitejs/plugin-react": "^4.3.2",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.1",
    "@playwright/test": "^1.48.0"
  },
  "overrides": {
    "@types/react": "npm:types-react@rc",
    "@types/react-dom": "npm:types-react-dom@rc"
  }
}
```

- [ ] **Step 2: Create `apps/operator/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "noEmit": true,
    "incremental": true,
    "allowJs": true
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/operator/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@queue/types', '@queue/mocks'],
};
export default nextConfig;
```

- [ ] **Step 4: Create `apps/operator/postcss.config.js`**

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 5: Create `apps/operator/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import preset from '../../tailwind.preset.js';

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

- [ ] **Step 6: Create `apps/operator/components.json`** (shadcn)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 7: Create `apps/operator/.eslintrc.json`**

```json
{ "extends": "../../.eslintrc.json" }
```

- [ ] **Step 8: Create `apps/operator/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 18% 7%;
    --foreground: 35 25% 95%;
    --card: 220 15% 10%;
    --card-foreground: 35 25% 95%;
    --primary: 39 55% 58%;
    --primary-foreground: 220 40% 9%;
    --muted: 220 15% 18%;
    --muted-foreground: 30 8% 65%;
    --border: 220 15% 18%;
    --input: 220 15% 18%;
    --ring: 39 55% 58%;
    --radius: 0.75rem;
  }

  * { border-color: hsl(var(--border)); }

  html, body {
    height: 100%;
    background-color: #141312;
    color: #F5F1E8;
    overflow: hidden; /* widget is fixed-size; never scroll */
  }

  body {
    font-feature-settings: 'ss01', 'zero', 'cv11';
    font-variant-numeric: tabular-nums;
  }
}

@layer components {
  .eyebrow {
    font-family: var(--font-jetbrains);
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.625rem;
    letter-spacing: 0.14em;
    color: #8A8277;
  }
}
```

- [ ] **Step 9: Create `apps/operator/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 10: Create `apps/operator/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'NDPI · Пульт оператора',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={jetbrains.variable}>
      <body className="h-screen w-screen overflow-hidden bg-ink-900 font-sans text-paper-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Create `apps/operator/app/page.tsx`** (placeholder)

```tsx
export default function Root() {
  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <div className="text-center">
        <span className="eyebrow">NDPI · Пульт</span>
        <h1 className="mt-4 text-2xl font-semibold">Загрузка…</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Install + typecheck + smoke-test dev**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm install
pnpm --filter @queue/operator typecheck
pnpm --filter @queue/operator dev &
sleep 6
curl -sI http://localhost:3003 | head -1
kill %1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 13: Commit**

```bash
git add apps/operator/
git commit -m "feat(operator): bootstrap Next.js widget app (port 3003, JetBrains Mono)"
```

---

### Task 7: Install shadcn components

**Files:**
- Create: `apps/operator/components/ui/*.tsx` (generated)

- [ ] **Step 1: Install the subset needed for the widget**

```bash
cd /Users/akkanat/Projects/queue-system/apps/operator
pnpm dlx shadcn@latest add button badge select sheet dialog sonner label --yes
```

Expected: files created under `apps/operator/components/ui/`.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/operator typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/operator/components/ui/
git commit -m "feat(operator): install shadcn components (button, badge, select, sheet, dialog, sonner, label)"
```

---

### Task 8: Operator store (Zustand + sessionStorage)

**Files:**
- Create: `apps/operator/vitest.config.ts`
- Create: `apps/operator/tests/setup.ts`
- Create: `apps/operator/tests/operator-store.test.ts`
- Create: `apps/operator/store/operator-store.ts`

- [ ] **Step 1: Create `apps/operator/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
});
```

- [ ] **Step 2: Create `apps/operator/tests/setup.ts`**

```ts
export {};
```

- [ ] **Step 3: Write failing test `tests/operator-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useOperatorStore } from '@/store/operator-store';

describe('operator-store', () => {
  beforeEach(() => {
    useOperatorStore.getState().logout();
    sessionStorage.clear();
  });

  it('starts signed-out', () => {
    expect(useOperatorStore.getState().isSignedIn()).toBe(false);
  });

  it('startShift persists user + counter + session', () => {
    useOperatorStore.getState().startShift({
      userId: 2,
      userName: 'Aygül',
      counterId: 1,
      counterNumber: '1',
      counterName: 'Окно 1',
      sessionId: 42,
    });
    const s = useOperatorStore.getState();
    expect(s.isSignedIn()).toBe(true);
    expect(s.userName).toBe('Aygül');
    expect(s.counterId).toBe(1);
    expect(s.sessionId).toBe(42);
  });

  it('logout clears everything', () => {
    useOperatorStore.getState().startShift({
      userId: 2, userName: 'Aygül', counterId: 1,
      counterNumber: '1', counterName: 'Окно 1', sessionId: 42,
    });
    useOperatorStore.getState().logout();
    expect(useOperatorStore.getState().isSignedIn()).toBe(false);
    expect(useOperatorStore.getState().counterId).toBeNull();
  });

  it('setOnBreak toggles a flag', () => {
    useOperatorStore.getState().startShift({
      userId: 2, userName: 'Aygül', counterId: 1,
      counterNumber: '1', counterName: 'Окно 1', sessionId: 42,
    });
    useOperatorStore.getState().setOnBreak(true);
    expect(useOperatorStore.getState().onBreak).toBe(true);
    useOperatorStore.getState().setOnBreak(false);
    expect(useOperatorStore.getState().onBreak).toBe(false);
  });
});
```

- [ ] **Step 4: Run, verify fail**

```bash
cd /Users/akkanat/Projects/queue-system/apps/operator
pnpm test
```

- [ ] **Step 5: Implement `apps/operator/store/operator-store.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ShiftInit {
  userId: number;
  userName: string;
  counterId: number;
  counterNumber: string;
  counterName: string;
  sessionId: number;
}

interface OperatorState {
  userId: number | null;
  userName: string | null;
  counterId: number | null;
  counterNumber: string | null;
  counterName: string | null;
  sessionId: number | null;
  onBreak: boolean;

  startShift: (init: ShiftInit) => void;
  setOnBreak: (v: boolean) => void;
  logout: () => void;
  isSignedIn: () => boolean;
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set, get) => ({
      userId: null,
      userName: null,
      counterId: null,
      counterNumber: null,
      counterName: null,
      sessionId: null,
      onBreak: false,

      startShift: (init) =>
        set({
          userId: init.userId,
          userName: init.userName,
          counterId: init.counterId,
          counterNumber: init.counterNumber,
          counterName: init.counterName,
          sessionId: init.sessionId,
          onBreak: false,
        }),

      setOnBreak: (v) => set({ onBreak: v }),

      logout: () =>
        set({
          userId: null,
          userName: null,
          counterId: null,
          counterNumber: null,
          counterName: null,
          sessionId: null,
          onBreak: false,
        }),

      isSignedIn: () => {
        const s = get();
        return s.userId !== null && s.counterId !== null && s.sessionId !== null;
      },
    }),
    {
      name: 'operator-shift',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? (undefined as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
```

- [ ] **Step 6: Run — 4 PASS**

```bash
pnpm test
```

- [ ] **Step 7: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/operator/vitest.config.ts apps/operator/tests/ apps/operator/store/
git commit -m "feat(operator): operator-store (Zustand + sessionStorage, tested)"
```

---

### Task 9: Providers + MSW init + typed API client

**Files:**
- Create: `apps/operator/lib/query-client.ts`
- Create: `apps/operator/lib/msw.ts`
- Create: `apps/operator/lib/api.ts`
- Create: `apps/operator/app/providers.tsx`

- [ ] **Step 1: Generate MSW SW**

```bash
cd /Users/akkanat/Projects/queue-system/apps/operator
pnpm msw:init
```

- [ ] **Step 2: Create `apps/operator/lib/query-client.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });
}

let browserClient: QueryClient | undefined;
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}
```

- [ ] **Step 3: Create `apps/operator/lib/msw.ts`**

```ts
'use client';

let started = false;

export async function startMsw(): Promise<void> {
  if (started) return;
  if (typeof window === 'undefined') return;
  const { worker } = await import('@queue/mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  started = true;
}
```

- [ ] **Step 4: Create `apps/operator/lib/api.ts`**

```ts
import type {
  Counter,
  User,
  OperatorSession,
  OperatorSessionStatus,
  Ticket,
  CreateOperatorSessionRequest,
  CallNextRequest,
  TransferTicketRequest,
} from '@queue/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  listCounters: () => fetch('/api/counters').then(json<Counter[]>),
  listUsers: () => fetch('/api/users').then(json<User[]>),

  createSession: (body: CreateOperatorSessionRequest) =>
    fetch('/api/operator-sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<OperatorSession>),

  updateSession: (id: number, status: OperatorSessionStatus) =>
    fetch(`/api/operator-sessions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(json<OperatorSession>),

  getQueue: (counterId: number) =>
    fetch(`/api/queue?counter_id=${counterId}`).then(json<Ticket[]>),

  getCurrent: (counterId: number) =>
    fetch(`/api/tickets/current?counter_id=${counterId}`).then(
      json<Ticket | null>,
    ),

  callNext: (body: CallNextRequest) =>
    fetch('/api/tickets/call-next', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),

  finishTicket: (id: string) =>
    fetch(`/api/tickets/${id}/finish`, { method: 'POST' }).then(json<Ticket>),

  skipTicket: (id: string) =>
    fetch(`/api/tickets/${id}/skip`, { method: 'POST' }).then(json<Ticket>),

  transferTicket: (id: string, body: TransferTicketRequest) =>
    fetch(`/api/tickets/${id}/transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json<Ticket>),
};
```

- [ ] **Step 5: Create `apps/operator/app/providers.tsx`**

```tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { startMsw } from '@/lib/msw';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(process.env.NODE_ENV !== 'development');

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startMsw().then(() => setMswReady(true));
    }
  }, []);

  if (!mswReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-xs text-ink-400">
        …
      </div>
    );
  }

  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster theme="dark" position="top-center" duration={2500} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Wire Providers into `apps/operator/app/layout.tsx`**

Replace the existing layout's `<body>` inner:

```tsx
<body className="h-screen w-screen overflow-hidden bg-ink-900 font-sans text-paper-100 antialiased">
  <Providers>{children}</Providers>
</body>
```

…and add the import:

```tsx
import { Providers } from './providers';
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/operator typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/operator/lib/ apps/operator/app/providers.tsx apps/operator/app/layout.tsx apps/operator/public/mockServiceWorker.js
git commit -m "feat(operator): Providers + MSW init + typed API client"
```

---

### Task 10: LoginScreen + CurrentTicket components

**Files:**
- Create: `apps/operator/components/LoginScreen.tsx`
- Create: `apps/operator/components/CurrentTicket.tsx`

- [ ] **Step 1: Create `apps/operator/components/LoginScreen.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

export function LoginScreen() {
  const startShift = useOperatorStore((s) => s.startShift);
  const [userId, setUserId] = useState<string>('');
  const [counterId, setCounterId] = useState<string>('');

  const users = useQuery({ queryKey: ['users'], queryFn: api.listUsers });
  const counters = useQuery({ queryKey: ['counters'], queryFn: api.listCounters });

  const operators = (users.data ?? []).filter(
    (u) => u.is_active && (u.role === 'operator' || u.role === 'admin'),
  );
  const activeCounters = (counters.data ?? []).filter((c) => c.is_active);

  const start = useMutation({
    mutationFn: () =>
      api.createSession({
        user_id: Number(userId),
        counter_id: Number(counterId),
      }),
    onSuccess: (session) => {
      const user = operators.find((u) => u.id === session.user_id);
      const counter = activeCounters.find((c) => c.id === session.counter_id);
      if (!user || !counter) {
        toast.error('Не найден пользователь или окно');
        return;
      }
      startShift({
        userId: user.id,
        userName: user.name,
        counterId: counter.id,
        counterNumber: counter.number,
        counterName: counter.name,
        sessionId: session.id,
      });
    },
    onError: () => toast.error('Не удалось начать смену'),
  });

  const canStart = userId && counterId && !start.isPending;

  return (
    <main className="flex h-screen w-screen flex-col justify-between p-6">
      <div>
        <span className="eyebrow text-brass-500">NDPI · Пульт</span>
        <h1 className="mt-3 text-xl font-semibold leading-tight">
          Начало смены
        </h1>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">Оператор</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue placeholder="Выбрать…" />
            </SelectTrigger>
            <SelectContent>
              {operators.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} · {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Окно</Label>
          <Select value={counterId} onValueChange={setCounterId}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue placeholder="Выбрать…" />
            </SelectTrigger>
            <SelectContent>
              {activeCounters.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  №{c.number} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => start.mutate()}
        disabled={!canStart}
        className="h-12 w-full bg-brass-500 text-ink-900 hover:bg-brass-400"
      >
        {start.isPending ? '…' : 'Начать смену'}
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Create `apps/operator/components/CurrentTicket.tsx`**

```tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, SkipForward } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  current: Ticket | null;
}

export function CurrentTicket({ current }: Props) {
  const qc = useQueryClient();

  const finish = useMutation({
    mutationFn: (id: string) => api.finishTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Завершено');
    },
    onError: () => toast.error('Не удалось завершить'),
  });

  const skip = useMutation({
    mutationFn: (id: string) => api.skipTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast('Пропущено');
    },
    onError: () => toast.error('Не удалось пропустить'),
  });

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-800/40 p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Сейчас обслуживаете</span>
        {current && (
          <span className="font-mono text-[10px] text-ink-500">
            #{current.id.slice(0, 6)}
          </span>
        )}
      </div>

      {current ? (
        <>
          <div className="mt-2 font-serif text-5xl font-semibold tracking-tight text-brass-400">
            {current.number}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => finish.mutate(current.id)}
              disabled={finish.isPending}
              className="h-10 flex-1 gap-1.5 bg-ink-700/70 text-xs hover:bg-ink-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Завершить
            </Button>
            <Button
              onClick={() => skip.mutate(current.id)}
              disabled={skip.isPending}
              variant="outline"
              className="h-10 flex-1 gap-1.5 border-ink-600 text-xs"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Пропустить
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-ink-400">
          Нет активного талона
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/operator typecheck
git add apps/operator/components/LoginScreen.tsx apps/operator/components/CurrentTicket.tsx
git commit -m "feat(operator): LoginScreen + CurrentTicket components"
```

---

### Task 11: CallNextButton + QueueList components

**Files:**
- Create: `apps/operator/components/CallNextButton.tsx`
- Create: `apps/operator/components/QueueList.tsx`

- [ ] **Step 1: Create `apps/operator/components/CallNextButton.tsx`**

```tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

interface Props {
  nextTicket: Ticket | null;   // oldest waiting, or null
  current: Ticket | null;       // blocks new call when present
  onBreak: boolean;
}

export function CallNextButton({ nextTicket, current, onBreak }: Props) {
  const qc = useQueryClient();
  const counterId = useOperatorStore((s) => s.counterId);
  const userId = useOperatorStore((s) => s.userId);

  const call = useMutation({
    mutationFn: () => {
      if (!counterId || !userId) throw new Error('not signed in');
      return api.callNext({ counter_id: counterId, operator_id: userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: () => toast.error('Не удалось вызвать'),
  });

  let label: string;
  let disabled = false;

  if (onBreak) {
    label = 'На перерыве';
    disabled = true;
  } else if (current) {
    label = 'Завершите текущий';
    disabled = true;
  } else if (!nextTicket) {
    label = 'Очередь пуста';
    disabled = true;
  } else {
    label = `ВЫЗВАТЬ ${nextTicket.number}`;
  }

  return (
    <Button
      onClick={() => call.mutate()}
      disabled={disabled || call.isPending}
      className="h-16 w-full gap-3 rounded-xl bg-brass-500 text-base font-bold uppercase tracking-wider text-ink-900 shadow-paper-lift transition-all duration-200 hover:bg-brass-400 active:translate-y-[1px] disabled:bg-ink-700/50 disabled:text-ink-500 disabled:shadow-none"
    >
      {!disabled && <ArrowRight className="h-5 w-5" />}
      <span className="font-mono">{label}</span>
    </Button>
  );
}
```

- [ ] **Step 2: Create `apps/operator/components/QueueList.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import type { Service, Ticket } from '@queue/types';

interface Props {
  queue: Ticket[];
  services: Service[];
}

function waitMinutes(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

export function QueueList({ queue, services }: Props) {
  const byId = useMemo(() => {
    const m = new Map<number, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const first = queue.slice(0, 5);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">Очередь</span>
        <span className="font-mono text-[11px] text-ink-400">
          {queue.length}
        </span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {first.length === 0 ? (
          <li className="text-xs text-ink-500">Пусто.</li>
        ) : (
          first.map((t, i) => {
            const svc = t.service_id != null ? byId.get(t.service_id) : null;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-800/30 px-3 py-2"
              >
                <span
                  className={
                    'font-mono text-sm font-semibold ' +
                    (i === 0 ? 'text-brass-400' : 'text-paper-100')
                  }
                >
                  {t.number}
                </span>
                <span className="flex-1 truncate text-[11px] text-ink-300">
                  {svc ? svc.name_ru : '—'}
                </span>
                <span className="font-mono text-[10px] text-ink-400">
                  {waitMinutes(t.created_at)}′
                </span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/operator typecheck
git add apps/operator/components/CallNextButton.tsx apps/operator/components/QueueList.tsx
git commit -m "feat(operator): CallNextButton + QueueList components"
```

---

### Task 12: OperatorFooter + TransferSheet + page.tsx assembly

**Files:**
- Create: `apps/operator/components/OperatorFooter.tsx`
- Create: `apps/operator/components/TransferSheet.tsx`
- Modify: `apps/operator/app/page.tsx` (full widget assembly)

- [ ] **Step 1: Create `apps/operator/components/TransferSheet.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Ticket } from '@queue/types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

interface Props {
  current: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferSheet({ current, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const myCounterId = useOperatorStore((s) => s.counterId);
  const [destination, setDestination] = useState<string>('');

  const counters = useQuery({ queryKey: ['counters'], queryFn: api.listCounters });
  const others = (counters.data ?? []).filter(
    (c) => c.is_active && c.id !== myCounterId,
  );

  const transfer = useMutation({
    mutationFn: () => {
      if (!current) throw new Error('no current');
      return api.transferTicket(current.id, { counter_id: Number(destination) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Переведено');
      setDestination('');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось перевести'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl font-normal">
            Перевод {current?.number ?? ''}
          </SheetTitle>
          <SheetDescription className="text-xs text-ink-400">
            Выберите окно, куда передать талон
          </SheetDescription>
        </SheetHeader>

        <div className="my-6 space-y-2">
          <Label className="text-xs">Окно назначения</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger><SelectValue placeholder="Выбрать…" /></SelectTrigger>
            <SelectContent>
              {others.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  №{c.number} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => transfer.mutate()}
            disabled={!destination || !current || transfer.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {transfer.isPending ? '…' : 'Перевести'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `apps/operator/components/OperatorFooter.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coffee, ArrowRightLeft, LogOut } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { TransferSheet } from './TransferSheet';

interface Props {
  current: Ticket | null;
}

export function OperatorFooter({ current }: Props) {
  const qc = useQueryClient();
  const { sessionId, onBreak, setOnBreak, logout } = useOperatorStore((s) => ({
    sessionId: s.sessionId,
    onBreak: s.onBreak,
    setOnBreak: s.setOnBreak,
    logout: s.logout,
  }));
  const [transferOpen, setTransferOpen] = useState(false);

  const toggleBreak = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error('no session');
      return api.updateSession(sessionId, onBreak ? 'active' : 'break');
    },
    onSuccess: () => {
      setOnBreak(!onBreak);
      toast(onBreak ? 'Работа возобновлена' : 'Вы на перерыве');
    },
    onError: () => toast.error('Не удалось'),
  });

  const endShift = useMutation({
    mutationFn: () => {
      if (!sessionId) return Promise.resolve();
      return api.updateSession(sessionId, 'ended');
    },
    onSuccess: () => {
      qc.clear();
      logout();
    },
  });

  return (
    <>
      <footer className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleBreak.mutate()}
          disabled={toggleBreak.isPending}
          className="h-9 flex-1 gap-1.5 border-ink-700 text-[11px]"
        >
          <Coffee className="h-3 w-3" />
          {onBreak ? 'Продолжить' : 'Перерыв'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTransferOpen(true)}
          disabled={!current}
          className="h-9 flex-1 gap-1.5 border-ink-700 text-[11px]"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Перевод
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => endShift.mutate()}
          className="h-9 gap-1.5 border-ink-700 text-[11px] text-ink-400"
        >
          <LogOut className="h-3 w-3" />
        </Button>
      </footer>

      <TransferSheet
        current={current}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
    </>
  );
}
```

> Note: the destructured-object Zustand selector above creates a new object each
> render and can cause re-render storms in React 19 RC (same bug we hit in the
> admin's TopBar). If it fires in dev, switch to four individual selectors. The
> final verify step (Task 15) flags this if it happens.

- [ ] **Step 3: Replace `apps/operator/app/page.tsx` with the full assembly**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import type { Service } from '@queue/types';
import { LoginScreen } from '@/components/LoginScreen';
import { CurrentTicket } from '@/components/CurrentTicket';
import { CallNextButton } from '@/components/CallNextButton';
import { QueueList } from '@/components/QueueList';
import { OperatorFooter } from '@/components/OperatorFooter';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function Page() {
  const signedIn = useOperatorStore((s) => s.isSignedIn());
  const counterId = useOperatorStore((s) => s.counterId);
  const counterNumber = useOperatorStore((s) => s.counterNumber);
  const counterName = useOperatorStore((s) => s.counterName);
  const userName = useOperatorStore((s) => s.userName);
  const onBreak = useOperatorStore((s) => s.onBreak);

  const current = useQuery({
    queryKey: ['current', counterId],
    queryFn: () => api.getCurrent(counterId!),
    enabled: !!counterId,
    refetchInterval: 3000,
  });
  const queue = useQuery({
    queryKey: ['queue', counterId],
    queryFn: () => api.getQueue(counterId!),
    enabled: !!counterId && !onBreak,
    refetchInterval: onBreak ? false : 3000,
  });
  const services = useQuery({ queryKey: ['services'], queryFn: fetchServices });

  if (!signedIn) return <LoginScreen />;

  const next = (queue.data ?? [])[0] ?? null;

  return (
    <main className="flex h-screen w-screen flex-col gap-3 p-4">
      <header className="leading-tight">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-brass-400">
            №{counterNumber}
          </span>
          <span className="truncate text-xs text-ink-300">{counterName}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-ink-400">· {userName}</span>
          {onBreak && (
            <span className="rounded-full border border-brass-500/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brass-400">
              перерыв
            </span>
          )}
        </div>
      </header>

      <CurrentTicket current={current.data ?? null} />

      <CallNextButton
        nextTicket={next}
        current={current.data ?? null}
        onBreak={onBreak}
      />

      <QueueList queue={queue.data ?? []} services={services.data ?? []} />

      <OperatorFooter current={current.data ?? null} />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/operator typecheck
git add apps/operator/components/ apps/operator/app/page.tsx
git commit -m "feat(operator): assemble widget — header, current, call-next, queue, footer, transfer"
```

---

### Task 13: Chrome launcher script + README

**Files:**
- Create: `apps/operator/scripts/launch.sh`
- Create: `apps/operator/README.md`

- [ ] **Step 1: Create `apps/operator/scripts/launch.sh`**

```bash
#!/usr/bin/env bash
# Launch the operator widget in a pinned Chrome app-mode window.
# Usage: ./launch.sh [URL]
#   URL defaults to http://localhost:3003
# Positions itself top-right by default; drag to wherever fits.

set -euo pipefail

URL="${1:-http://localhost:3003}"
WIDTH=360
HEIGHT=560

# macOS
if [[ "$(uname -s)" == "Darwin" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [[ ! -x "$CHROME" ]]; then
    echo "Google Chrome not found at $CHROME" >&2
    exit 1
  fi
  exec "$CHROME" \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run \
    --no-default-browser-check
fi

# Linux (Ubuntu)
if command -v google-chrome >/dev/null 2>&1; then
  exec google-chrome \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run \
    --no-default-browser-check
fi

if command -v chromium >/dev/null 2>&1; then
  exec chromium \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run
fi

echo "No supported Chromium-based browser found (tried google-chrome, chromium)." >&2
exit 1
```

Make it executable:

```bash
chmod +x /Users/akkanat/Projects/queue-system/apps/operator/scripts/launch.sh
```

- [ ] **Step 2: Create `apps/operator/README.md`**

```markdown
# NDPI Queue — Operator Widget

A 360×560 Chrome app-mode widget that operators pin to the corner of their
screen. One main button: **ВЫЗВАТЬ <номер>**. Plus finish / skip / transfer /
break — and that's it.

## Quick start (dev)

```bash
pnpm --filter @queue/operator dev        # http://localhost:3003
./apps/operator/scripts/launch.sh         # opens widget in pinned window
```

Pick an operator + counter on the login screen → start shift → the widget
polls the mock queue every 3s and shows the next ticket.

## Install on an operator's PC

1. Copy `scripts/launch.sh` somewhere in `$PATH` (e.g. `~/bin/ndpi-widget`).
2. Change the URL at the top of the script to point to your production host
   (e.g. `https://queue.ndpi.uz/operator`).
3. Create a desktop shortcut that runs the script. On GNOME/KDE use a
   `.desktop` file; on Windows bundle as an `.exe` via any `sh→cmd` wrapper
   (or just create a batch file with `start chrome --app=... --window-size=360,560`).

The widget state (operator + counter) persists in `sessionStorage`, so
closing the window logs the operator out — that's intentional so the widget
is always fresh at the start of each shift.

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm --filter @queue/operator dev` | Dev server on :3003 |
| `pnpm --filter @queue/operator build` | Production bundle |
| `pnpm --filter @queue/operator test` | Vitest (operator-store) |
| `pnpm --filter @queue/operator test:e2e` | Playwright smoke |

## Known limitations (Phase 4)

- **Polling, not WebSocket.** Queue refresh is every 3 s. Phase 5 replaces
  this with real-time via Django Channels.
- **Dev login without password.** Session creation trusts the picked user.
  Phase 6 wires a real auth token.
- **No sound notification on new queue entries.** Add in a future phase if
  operators ask for it.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/operator/scripts/ apps/operator/README.md
git commit -m "docs(operator): launch script + README (Chrome app-mode)"
```

---

### Task 14: Playwright E2E — widget smoke

**Files:**
- Create: `apps/operator/playwright.config.ts`
- Create: `apps/operator/tests/e2e/widget-smoke.spec.ts`

- [ ] **Step 1: Create `apps/operator/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3003',
    viewport: { width: 400, height: 600 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Create `apps/operator/tests/e2e/widget-smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('operator flow: login → call next → finish', async ({ page }) => {
  await page.goto('/');

  // Login screen
  await expect(page.getByRole('heading', { name: 'Начало смены' })).toBeVisible({
    timeout: 20_000,
  });

  // Pick operator (first "operator" in the seed is operator1 · Aygül Nurmanova → role=operator)
  await page.getByText('Выбрать…').first().click();
  await page.getByRole('option', { name: /operator/i }).first().click();

  // Pick counter
  await page.getByText('Выбрать…').first().click();
  await page.getByRole('option', { name: /№1/ }).click();

  await page.getByRole('button', { name: 'Начать смену' }).click();

  // Widget loaded — we see the "№1" header
  await expect(page.locator('text=/№\\s*1/').first()).toBeVisible({
    timeout: 10_000,
  });

  // The Call-Next button shows a ticket number when queue has items
  const callBtn = page.getByRole('button', { name: /ВЫЗВАТЬ\s+[A-Z]\d+/ });
  await expect(callBtn).toBeEnabled({ timeout: 10_000 });
  await callBtn.click();

  // After call, "Сейчас обслуживаете" has a number
  await expect(page.locator('text=Сейчас обслуживаете')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Завершить' })).toBeEnabled({
    timeout: 5_000,
  });

  // Finish
  await page.getByRole('button', { name: 'Завершить' }).click();

  // Back to "Нет активного талона"
  await expect(page.locator('text=Нет активного талона')).toBeVisible({
    timeout: 5_000,
  });
});
```

- [ ] **Step 3: Install browsers (shared cache with other apps)**

```bash
cd /Users/akkanat/Projects/queue-system/apps/operator
pnpm exec playwright install chromium
```

- [ ] **Step 4: Run E2E**

```bash
cd /Users/akkanat/Projects/queue-system
lsof -ti:3003 | xargs kill -9 2>/dev/null; true
pnpm --filter @queue/operator test:e2e
```

Expected: 1 test PASS. If MSW boot is slow the first run may fail — rerun once.

- [ ] **Step 5: Commit**

```bash
git add apps/operator/playwright.config.ts apps/operator/tests/e2e/
git commit -m "test(operator): Playwright smoke (login → call → finish)"
```

---

### Task 15: Final verification + root README

**Files:**
- Modify: `README.md` (root)

- [ ] **Step 1: All checks green**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm typecheck
pnpm test
(cd agent && go test ./...)
pnpm --filter @queue/kiosk test:e2e
pnpm --filter @queue/admin test:e2e
pnpm --filter @queue/operator test:e2e
```

Expected: every step green. If Zustand selectors cause re-render loops in the operator app (Phase 3 pattern), fix them inline by replacing any destructured-object selectors with individual selectors, as done in admin's TopBar/AuthGuard. Commit the fix as `fix(operator): use individual Zustand selectors to avoid render loops`.

- [ ] **Step 2: Update root `README.md`**

```diff
- - ⏳ Phase 4 — operator console on mocks
+ - ✅ Phase 4 — operator mini-widget (Chrome app-mode, 360×560)
```

```diff
-   operator/    # operator console (planned)
+   operator/    # operator mini-widget — Next.js 15, Chrome app-mode
```

Append a third line to Quick start:

```diff
 pnpm --filter @queue/admin dev   # http://localhost:3002  (login admin/admin)
+pnpm --filter @queue/operator dev # http://localhost:3003  (pick any operator + counter)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: mark Phase 4 (operator widget) complete"
```

---

## Verification Checklist

- [ ] `pnpm typecheck` clean across 5 packages (types, mocks, kiosk, admin, operator).
- [ ] `pnpm test` PASS: kiosk (10) + mocks (≥ 30 after ticket-store + op-session-store additions) + admin (4) + operator (4).
- [ ] `cd agent && go test ./...` PASS.
- [ ] All three Playwright suites PASS (kiosk, admin, operator).
- [ ] Widget on `:3003` opens in Chrome app-mode via `./apps/operator/scripts/launch.sh`.
- [ ] Login → pick `operator1` + `№1` → widget shows queue from seed.
- [ ] Press **Вызвать A013** → current shows A013 → **Завершить** → current clears, button re-enables with the next number.
- [ ] **Перерыв** toggles `onBreak`, the Call-Next button shows "На перерыве".
- [ ] **Перевод** moves the active ticket to another counter; it disappears from current + reappears in that counter's queue.

## Open Questions for Phase 5+

- **Real-time.** Poll → WebSocket. Every op (`call-next`, `finish`, transfer) becomes a broadcast that other operators + the display see instantly.
- **Sound.** Operators asked for a ding when a new ticket enters their queue. Small audio element, opt-in toggle in footer.
- **Multi-queue counters.** Counter 3 serves categories D+E — right now the operator sees a merged queue. If they need to see "next E vs next D" separately, QueueList can switch to a tabbed view.
- **Tray integration.** If later ops want REAL tray presence (not Chrome window), extend the Go agent with a `systray` menu that POSTs to the cloud — keep this app as a fallback.
