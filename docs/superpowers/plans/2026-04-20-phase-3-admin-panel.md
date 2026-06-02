# Phase 3 — Admin Panel (on mocks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Next.js admin panel at `apps/admin` — login page, sidebar layout, dashboard with stub metrics, CRUD for services/categories/counters/operators — all backed by MSW mocks with in-memory persistence for the session.

**Architecture:** A second Next.js 15 app that shares `packages/types`, `packages/mocks`, the monorepo `tailwind.preset.js`, and the JetBrains Mono + ink/brass visual language with the kiosk. MSW handlers are upgraded from read-only JSON to in-memory stores (CategoryStore, ServiceStore, CounterStore, UserStore) so PATCH / POST / DELETE actually mutate within a session. Auth is a stub: `admin/admin` → signed-looking JWT held in Zustand + sessionStorage; a client-side guard redirects unauthenticated requests to `/login`.

**Tech Stack:** Next.js 15 App Router, React 19 (RC), TypeScript strict, Tailwind + shadcn/ui (Button / Input / Label / Select / Sheet / Table / Badge / Card / Form / Separator / Switch / Checkbox / Dropdown-Menu / Sonner), TanStack Query, Zustand (with `persist` middleware), MSW 2 for mocks, Playwright for E2E, Vitest + React Testing Library for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-20-queue-system-design.md` §6 (data model), §8 phase 3.

---

## File Map

```
queue-system/
├── packages/types/src/index.ts                 # + Counter, User, AuthState, DashboardMetrics
│
├── packages/mocks/
│   ├── src/
│   │   ├── fixtures/
│   │   │   ├── counters.json                   # NEW — 5 seeded counters
│   │   │   ├── users.json                      # NEW — 4 seeded users
│   │   │   └── dashboard.json                  # NEW — stub metrics & hourly chart
│   │   ├── category-store.ts                   # NEW — PATCH support
│   │   ├── service-store.ts                    # NEW — PATCH support
│   │   ├── counter-store.ts                    # NEW — full CRUD
│   │   ├── user-store.ts                       # NEW — full CRUD + authenticate
│   │   ├── ticket-store.ts                     # unchanged
│   │   ├── handlers.ts                         # MAJOR UPDATE — wire stores + new routes
│   │   └── index.ts                            # re-exports
│   └── tests/
│       ├── counter-store.test.ts               # NEW
│       └── user-store.test.ts                  # NEW
│
└── apps/admin/                                  # NEW APP
    ├── package.json
    ├── next.config.mjs
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── components.json                         # shadcn config
    ├── vitest.config.ts
    ├── playwright.config.ts
    ├── .eslintrc.json
    ├── public/
    │   └── mockServiceWorker.js                # via `msw init`
    ├── app/
    │   ├── layout.tsx                          # root: font, providers, auth guard
    │   ├── globals.css
    │   ├── providers.tsx                       # TanStack + MSW init + sonner
    │   ├── page.tsx                            # redirects based on auth
    │   ├── login/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx                      # sidebar + topbar route group
    │       ├── page.tsx                        # dashboard overview
    │       ├── services/page.tsx
    │       ├── categories/page.tsx
    │       ├── counters/page.tsx
    │       └── operators/page.tsx
    ├── components/
    │   ├── ui/                                 # shadcn (generated)
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   └── Breadcrumbs.tsx
    │   ├── AuthGuard.tsx
    │   ├── StatCard.tsx
    │   ├── HourlyLoadChart.tsx
    │   ├── ServiceEditSheet.tsx
    │   ├── CategoryEditSheet.tsx
    │   ├── CounterEditSheet.tsx
    │   └── OperatorEditSheet.tsx
    ├── lib/
    │   ├── utils.ts                            # cn()
    │   ├── msw.ts                              # dev-only init
    │   ├── query-client.ts
    │   └── api.ts                              # typed fetch wrappers
    ├── store/
    │   └── auth-store.ts
    └── tests/
        ├── auth-store.test.ts
        └── e2e/admin-smoke.spec.ts
```

---

## Known Constraints & Decisions

- **Auth is stubbed**, not real. Middleware-based guards need cookies (server-side); we instead use a client-side `<AuthGuard>` that checks the Zustand store and redirects to `/login`. This keeps things simple and consistent with how the kiosk does client-only state.
- **Single locale (RU)** — admins speak Russian. Keeping next-intl out of the admin cuts ~25 tasks we'd need to wire locales.
- **No heavy chart library** — the hourly-load bar chart is hand-rolled with Tailwind width/height utilities. Good enough for stub data; swap for Recharts in v2 if real data volumes demand.
- **MSW stores are module-level singletons** seeded from JSON fixtures. Data survives route changes and soft reloads. A full browser restart resets everything — acceptable for a demo-grade admin.
- **Bar width of the sidebar = 256px.** Typography scale stays JetBrains Mono, but we drop size by ~20% versus kiosk (admin is desktop, dense).

---

### Task 1: Extend `packages/types` with Counter / User / AuthState

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Read the existing types file to see current shape**

```bash
cat /Users/akkanat/Projects/queue-system/packages/types/src/index.ts
```

Expected: it already exports `DeliveryType`, `TicketStatus`, `UserRole`, `ServiceCategory`, `Service`, `Ticket`, `CreateTicketRequest`.

- [ ] **Step 2: Append new types to the end of the file**

Add this block at the end of `packages/types/src/index.ts` (do NOT remove or modify existing exports):

```ts

// -------- Phase 3 additions --------

export interface Counter {
  id: number;
  number: string;         // display label, e.g. "1", "2A"
  name: string;           // e.g. "Окно 1 · Акад. справки"
  service_ids: number[];  // which services this counter serves
  is_active: boolean;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  counter_id: number | null;  // assigned counter for operators; null for admins/viewers
  is_active: boolean;
}

export interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: number | null;   // unix ms
}

export interface DashboardMetrics {
  ticketsToday: number;
  avgWaitMinutes: number;
  activeCounters: number;
  served: number;
}

export interface HourlyLoadPoint {
  hour: number;           // 8..18
  issued: number;
  served: number;
}

export interface RecentTicket {
  id: string;
  number: string;
  category_code: string;
  service_name: string;
  status: TicketStatus;
  counter_number: string | null;
  issued_at: string;      // ISO
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: UserRole;
  expires_at: string;     // ISO
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/types typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add Counter, User, AuthState, DashboardMetrics"
```

---

### Task 2: Seed fixtures for counters / users / dashboard

**Files:**
- Create: `packages/mocks/src/fixtures/counters.json`
- Create: `packages/mocks/src/fixtures/users.json`
- Create: `packages/mocks/src/fixtures/dashboard.json`

- [ ] **Step 1: Create `packages/mocks/src/fixtures/counters.json`**

Five counters. Service-ids below reference the 65-service fixture created in Phase 0 — the grouping keeps each counter covering one or two categories.

```json
[
  {
    "id": 1,
    "number": "1",
    "name": "Okno 1 — Akademiyalıq + Onlayn",
    "service_ids": [1, 2, 9, 10, 11, 12, 13, 14, 15],
    "is_active": true
  },
  {
    "id": 2,
    "number": "2",
    "name": "Okno 2 — HEMIS + Hújjetler",
    "service_ids": [21, 23, 61, 63, 64, 65],
    "is_active": true
  },
  {
    "id": 3,
    "number": "3",
    "name": "Okno 3 — Qosımsha + Buxgalteriya",
    "service_ids": [25, 26, 30, 31, 32, 33, 34, 37, 38, 39, 40],
    "is_active": true
  },
  {
    "id": 4,
    "number": "4",
    "name": "Okno 4 — Buyrıqlar / Mobillik",
    "service_ids": [41, 42, 43],
    "is_active": true
  },
  {
    "id": 5,
    "number": "5",
    "name": "Okno 5 — Xalıqaralıq + Ilimiy",
    "service_ids": [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 57, 58],
    "is_active": true
  }
]
```

- [ ] **Step 2: Create `packages/mocks/src/fixtures/users.json`**

```json
[
  {
    "id": 1,
    "username": "admin",
    "name": "Administrator",
    "role": "admin",
    "counter_id": null,
    "is_active": true
  },
  {
    "id": 2,
    "username": "operator1",
    "name": "Aygül Nurmanova",
    "role": "operator",
    "counter_id": 1,
    "is_active": true
  },
  {
    "id": 3,
    "username": "operator2",
    "name": "Bahadır Qadirov",
    "role": "operator",
    "counter_id": 2,
    "is_active": true
  },
  {
    "id": 4,
    "username": "viewer",
    "name": "Marat Rejepov",
    "role": "viewer",
    "counter_id": null,
    "is_active": true
  }
]
```

- [ ] **Step 3: Create `packages/mocks/src/fixtures/dashboard.json`**

Stub data — shape matches the types we defined in Task 1. Hourly bars peak around 10–11 and 14–15 like real office traffic.

```json
{
  "metrics": {
    "ticketsToday": 127,
    "avgWaitMinutes": 9,
    "activeCounters": 5,
    "served": 112
  },
  "hourly": [
    { "hour": 8,  "issued": 4,  "served": 3 },
    { "hour": 9,  "issued": 12, "served": 10 },
    { "hour": 10, "issued": 22, "served": 18 },
    { "hour": 11, "issued": 24, "served": 21 },
    { "hour": 12, "issued": 9,  "served": 8 },
    { "hour": 13, "issued": 6,  "served": 6 },
    { "hour": 14, "issued": 18, "served": 17 },
    { "hour": 15, "issued": 19, "served": 15 },
    { "hour": 16, "issued": 10, "served": 9 },
    { "hour": 17, "issued": 3,  "served": 5 }
  ],
  "recent": [
    { "id": "00000000-aaaa-0001", "number": "A017", "category_code": "A", "service_name": "Akademiyalıq maǵlıwmatnama",   "status": "served",  "counter_number": "1", "issued_at": "2026-04-20T09:12:00Z" },
    { "id": "00000000-aaaa-0002", "number": "E004", "category_code": "E", "service_name": "Tólem-shártnama",               "status": "served",  "counter_number": "3", "issued_at": "2026-04-20T09:18:00Z" },
    { "id": "00000000-aaaa-0003", "number": "A018", "category_code": "A", "service_name": "Oqıw qaǵazı",                   "status": "served",  "counter_number": "1", "issued_at": "2026-04-20T09:25:00Z" },
    { "id": "00000000-aaaa-0004", "number": "I003", "category_code": "I", "service_name": "Diplom qosımshası",             "status": "serving", "counter_number": "2", "issued_at": "2026-04-20T10:02:00Z" },
    { "id": "00000000-aaaa-0005", "number": "G002", "category_code": "G", "service_name": "Maǵlıwmatnama inglis tilinde",  "status": "waiting", "counter_number": null, "issued_at": "2026-04-20T10:08:00Z" },
    { "id": "00000000-aaaa-0006", "number": "A019", "category_code": "A", "service_name": "GPA kórsetkishi",               "status": "served",  "counter_number": "1", "issued_at": "2026-04-20T10:14:00Z" },
    { "id": "00000000-aaaa-0007", "number": "F001", "category_code": "F", "service_name": "Akademiyalıq mobillik",         "status": "serving", "counter_number": "4", "issued_at": "2026-04-20T10:20:00Z" },
    { "id": "00000000-aaaa-0008", "number": "D002", "category_code": "D", "service_name": "Imtixan apellyaciyası",         "status": "waiting", "counter_number": null, "issued_at": "2026-04-20T10:27:00Z" },
    { "id": "00000000-aaaa-0009", "number": "C002", "category_code": "C", "service_name": "Studentlik guwalıǵı",           "status": "waiting", "counter_number": null, "issued_at": "2026-04-20T10:30:00Z" },
    { "id": "00000000-aaaa-0010", "number": "H001", "category_code": "H", "service_name": "Ilimiy grant",                  "status": "called",  "counter_number": "5", "issued_at": "2026-04-20T10:33:00Z" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/mocks/src/fixtures/
git commit -m "feat(mocks): add counters, users, dashboard seed fixtures"
```

---

### Task 3: CounterStore + UserStore with full CRUD

**Files:**
- Create: `packages/mocks/src/counter-store.ts`
- Create: `packages/mocks/src/user-store.ts`
- Create: `packages/mocks/tests/counter-store.test.ts`
- Create: `packages/mocks/tests/user-store.test.ts`

- [ ] **Step 1: Write failing CounterStore test** — `packages/mocks/tests/counter-store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CounterStore } from '../src/counter-store';

describe('CounterStore', () => {
  let store: CounterStore;
  beforeEach(() => {
    store = new CounterStore([
      { id: 1, number: '1', name: 'Okno 1', service_ids: [1, 2], is_active: true },
      { id: 2, number: '2', name: 'Okno 2', service_ids: [3], is_active: false },
    ]);
  });

  it('list returns all counters', () => {
    expect(store.list()).toHaveLength(2);
  });

  it('get returns a counter by id or undefined', () => {
    expect(store.get(1)?.name).toBe('Okno 1');
    expect(store.get(999)).toBeUndefined();
  });

  it('create assigns next id and adds to list', () => {
    const c = store.create({ number: '3', name: 'Okno 3', service_ids: [4, 5], is_active: true });
    expect(c.id).toBe(3);
    expect(store.list()).toHaveLength(3);
  });

  it('update mutates fields and returns the new counter', () => {
    const c = store.update(1, { name: 'Renamed', is_active: false });
    expect(c?.name).toBe('Renamed');
    expect(c?.is_active).toBe(false);
    expect(store.get(1)?.name).toBe('Renamed');
  });

  it('update returns undefined for unknown id', () => {
    expect(store.update(999, { name: 'x' })).toBeUndefined();
  });

  it('remove returns true and drops the counter', () => {
    expect(store.remove(1)).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it('remove returns false for unknown id', () => {
    expect(store.remove(999)).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing UserStore test** — `packages/mocks/tests/user-store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../src/user-store';

describe('UserStore', () => {
  let store: UserStore;
  beforeEach(() => {
    store = new UserStore([
      { id: 1, username: 'admin',    name: 'Admin', role: 'admin',    counter_id: null, is_active: true },
      { id: 2, username: 'operator', name: 'Op',    role: 'operator', counter_id: 1,    is_active: true },
    ]);
  });

  it('authenticates with correct credentials', () => {
    const u = store.authenticate('admin', 'admin');
    expect(u?.username).toBe('admin');
  });

  it('rejects wrong password', () => {
    expect(store.authenticate('admin', 'nope')).toBeUndefined();
  });

  it('rejects inactive users', () => {
    store.update(1, { is_active: false });
    expect(store.authenticate('admin', 'admin')).toBeUndefined();
  });

  it('create adds a user and returns it', () => {
    const u = store.create({
      username: 'new',
      name: 'New',
      role: 'viewer',
      counter_id: null,
      is_active: true,
    });
    expect(u.id).toBe(3);
    expect(store.list()).toHaveLength(3);
  });

  it('update mutates fields', () => {
    const u = store.update(1, { name: 'Admin 2' });
    expect(u?.name).toBe('Admin 2');
  });

  it('remove drops a user', () => {
    expect(store.remove(1)).toBe(true);
    expect(store.list()).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests — confirm fail**

```bash
cd /Users/akkanat/Projects/queue-system/packages/mocks
pnpm test
```

Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `packages/mocks/src/counter-store.ts`**

```ts
import type { Counter } from '@queue/types';

export class CounterStore {
  private items: Counter[];
  private nextId: number;

  constructor(initial: Counter[]) {
    this.items = initial.map((c) => ({ ...c }));
    this.nextId = (this.items.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  }

  list(): Counter[] {
    return this.items.map((c) => ({ ...c }));
  }

  get(id: number): Counter | undefined {
    const c = this.items.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  create(input: Omit<Counter, 'id'>): Counter {
    const c: Counter = { ...input, id: this.nextId++ };
    this.items.push(c);
    return { ...c };
  }

  update(id: number, patch: Partial<Omit<Counter, 'id'>>): Counter | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: Counter = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }

  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
```

- [ ] **Step 5: Implement `packages/mocks/src/user-store.ts`**

```ts
import type { User } from '@queue/types';

export class UserStore {
  private items: User[];
  private nextId: number;

  constructor(initial: User[]) {
    this.items = initial.map((u) => ({ ...u }));
    this.nextId = (this.items.reduce((m, u) => Math.max(m, u.id), 0) || 0) + 1;
  }

  list(): User[] {
    return this.items.map((u) => ({ ...u }));
  }

  get(id: number): User | undefined {
    const u = this.items.find((x) => x.id === id);
    return u ? { ...u } : undefined;
  }

  // For the dev stub, the password that works is always the username itself
  // (`admin/admin`, `operator1/operator1`). Production uses a real hash.
  authenticate(username: string, password: string): User | undefined {
    const u = this.items.find((x) => x.username === username);
    if (!u || !u.is_active) return undefined;
    if (password !== username) return undefined;
    return { ...u };
  }

  create(input: Omit<User, 'id'>): User {
    const u: User = { ...input, id: this.nextId++ };
    this.items.push(u);
    return { ...u };
  }

  update(id: number, patch: Partial<Omit<User, 'id'>>): User | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: User = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }

  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
```

- [ ] **Step 6: Run tests — confirm 13 pass (7 CounterStore + 6 UserStore)**

```bash
pnpm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add packages/mocks/src/counter-store.ts packages/mocks/src/user-store.ts packages/mocks/tests/
git commit -m "feat(mocks): add CounterStore + UserStore with CRUD (tested)"
```

---

### Task 4: CategoryStore + ServiceStore (PATCH support)

**Files:**
- Create: `packages/mocks/src/category-store.ts`
- Create: `packages/mocks/src/service-store.ts`

These don't strictly need dedicated test files — behavior mirrors CounterStore which is fully tested. One test each is enough to verify the PATCH contract.

- [ ] **Step 1: Implement `packages/mocks/src/category-store.ts`**

```ts
import type { ServiceCategory } from '@queue/types';

export class CategoryStore {
  private items: ServiceCategory[];

  constructor(initial: ServiceCategory[]) {
    this.items = initial.map((c) => ({ ...c }));
  }

  list(): ServiceCategory[] {
    return this.items.map((c) => ({ ...c }));
  }

  get(id: number): ServiceCategory | undefined {
    const c = this.items.find((x) => x.id === id);
    return c ? { ...c } : undefined;
  }

  update(id: number, patch: Partial<Omit<ServiceCategory, 'id'>>): ServiceCategory | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: ServiceCategory = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }
}
```

- [ ] **Step 2: Implement `packages/mocks/src/service-store.ts`**

```ts
import type { Service } from '@queue/types';

export class ServiceStore {
  private items: Service[];

  constructor(initial: Service[]) {
    this.items = initial.map((s) => ({ ...s }));
  }

  list(): Service[] {
    return this.items.map((s) => ({ ...s }));
  }

  listByCategory(categoryId: number): Service[] {
    return this.items
      .filter((s) => s.category_id === categoryId)
      .map((s) => ({ ...s }));
  }

  get(id: number): Service | undefined {
    const s = this.items.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  update(id: number, patch: Partial<Omit<Service, 'id'>>): Service | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: Service = { ...existing, ...patch };
    this.items[idx] = updated;
    return { ...updated };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/mocks/src/category-store.ts packages/mocks/src/service-store.ts
git commit -m "feat(mocks): add CategoryStore + ServiceStore with PATCH support"
```

---

### Task 5: Rewrite `packages/mocks/src/handlers.ts` to wire new stores + new routes

**Files:**
- Modify: `packages/mocks/src/handlers.ts`
- Modify: `packages/mocks/src/index.ts`

- [ ] **Step 1: Read the current handlers to see what we're replacing**

```bash
cat /Users/akkanat/Projects/queue-system/packages/mocks/src/handlers.ts
```

(File currently uses raw JSON imports for categories/services and a TicketStore for POST /api/tickets.)

- [ ] **Step 2: Replace `packages/mocks/src/handlers.ts` with the extended version**

```ts
import { http, HttpResponse } from 'msw';
import categoriesSeed from './fixtures/categories.json';
import servicesSeed from './fixtures/services.json';
import countersSeed from './fixtures/counters.json';
import usersSeed from './fixtures/users.json';
import dashboardSeed from './fixtures/dashboard.json';
import { TicketStore } from './ticket-store';
import { CategoryStore } from './category-store';
import { ServiceStore } from './service-store';
import { CounterStore } from './counter-store';
import { UserStore } from './user-store';
import type {
  CreateTicketRequest,
  ServiceCategory,
  Counter,
  User,
  LoginRequest,
} from '@queue/types';

// Module-level singletons — the MSW service worker holds their state for the
// entire session. Each app that runs MSW has its own SW → independent state.
import type { Service } from '@queue/types';
const categories = new CategoryStore(categoriesSeed as ServiceCategory[]);
const servicesStore = new ServiceStore(servicesSeed as unknown as Service[]);
const counters = new CounterStore(countersSeed as unknown as Counter[]);
const users = new UserStore(usersSeed as unknown as User[]);
const tickets = new TicketStore();

export const handlers = [
  // ---------- auth ----------
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    const user = users.authenticate(body.username, body.password);
    if (!user) {
      return HttpResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 },
      );
    }
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h
    return HttpResponse.json({
      token: `dev.${user.username}.${expiresAt.getTime()}`,
      username: user.username,
      role: user.role,
      expires_at: expiresAt.toISOString(),
    });
  }),

  // ---------- categories ----------
  http.get('/api/categories', () => HttpResponse.json(categories.list())),

  http.patch('/api/categories/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Record<string, unknown>;
    const updated = categories.update(id, patch);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  // ---------- services ----------
  http.get('/api/services', ({ request }) => {
    const url = new URL(request.url);
    const cat = url.searchParams.get('category_id');
    const list = cat
      ? servicesStore.listByCategory(Number(cat))
      : servicesStore.list();
    return HttpResponse.json(list);
  }),

  http.patch('/api/services/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Record<string, unknown>;
    const updated = servicesStore.update(id, patch);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  // ---------- counters ----------
  http.get('/api/counters', () => HttpResponse.json(counters.list())),

  http.post('/api/counters', async ({ request }) => {
    const body = (await request.json()) as Omit<Counter, 'id'>;
    const created = counters.create(body);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('/api/counters/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Record<string, unknown>;
    const updated = counters.update(id, patch);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.delete('/api/counters/:id', ({ params }) => {
    const id = Number(params.id);
    const ok = counters.remove(id);
    if (!ok) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- users ----------
  http.get('/api/users', () => HttpResponse.json(users.list())),

  http.post('/api/users', async ({ request }) => {
    const body = (await request.json()) as Omit<User, 'id'>;
    const created = users.create(body);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('/api/users/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Record<string, unknown>;
    const updated = users.update(id, patch);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.delete('/api/users/:id', ({ params }) => {
    const id = Number(params.id);
    const ok = users.remove(id);
    if (!ok) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- dashboard ----------
  http.get('/api/dashboard', () => HttpResponse.json(dashboardSeed)),

  // ---------- tickets (unchanged from Phase 1) ----------
  http.post('/api/tickets', async ({ request }) => {
    const body = (await request.json()) as CreateTicketRequest;
    const category = categories.get(body.category_id);
    if (!category) {
      return HttpResponse.json({ error: 'unknown category' }, { status: 400 });
    }
    await new Promise((r) => setTimeout(r, 150));
    const ticket = tickets.create({
      category_id: body.category_id,
      code: category.code,
      service_id: body.service_id,
      idempotency_key: body.idempotency_key,
    });
    return HttpResponse.json(ticket, { status: 201 });
  }),
];
```

- [ ] **Step 3: Update `packages/mocks/src/index.ts` to re-export the new stores**

```ts
export { handlers } from './handlers';
export { TicketStore } from './ticket-store';
export { CategoryStore } from './category-store';
export { ServiceStore } from './service-store';
export { CounterStore } from './counter-store';
export { UserStore } from './user-store';
export { default as categories } from './fixtures/categories.json';
export { default as services } from './fixtures/services.json';
export { default as counters } from './fixtures/counters.json';
export { default as users } from './fixtures/users.json';
export { default as dashboard } from './fixtures/dashboard.json';
```

- [ ] **Step 4: Typecheck + tests**

```bash
cd /Users/akkanat/Projects/queue-system/packages/mocks
pnpm typecheck
pnpm test
```

Expected: typecheck clean, all tests pass (old ticket-store + new counter/user-store).

- [ ] **Step 5: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add packages/mocks/src/handlers.ts packages/mocks/src/index.ts
git commit -m "feat(mocks): handlers wire stores + add CRUD + auth + dashboard routes"
```

---

### Task 6: Bootstrap `apps/admin` (Next.js 15 skeleton)

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/next.config.mjs`
- Create: `apps/admin/postcss.config.js`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/components.json`
- Create: `apps/admin/.eslintrc.json`
- Create: `apps/admin/app/globals.css`
- Create: `apps/admin/app/layout.tsx`
- Create: `apps/admin/app/page.tsx` (stub)
- Create: `apps/admin/lib/utils.ts`

The kiosk app is the closest reference — mimic its structure.

- [ ] **Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@queue/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
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
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.2",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
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
    "@testing-library/user-event": "^14.5.2",
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

- [ ] **Step 2: Create `apps/admin/tsconfig.json`**

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

- [ ] **Step 3: Create `apps/admin/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@queue/types', '@queue/mocks'],
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/admin/postcss.config.js`**

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Create `apps/admin/tailwind.config.ts`**

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

- [ ] **Step 6: Create `apps/admin/components.json`**

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

- [ ] **Step 7: Create `apps/admin/.eslintrc.json`**

```json
{ "extends": "../../.eslintrc.json" }
```

- [ ] **Step 8: Create `apps/admin/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 11%;
    --foreground: 35 25% 95%;
    --card: 220 20% 11%;
    --card-foreground: 35 25% 95%;
    --primary: 39 55% 58%;
    --primary-foreground: 220 40% 9%;
    --muted: 220 15% 20%;
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
    background-image:
      radial-gradient(at 18% 10%, rgba(201, 169, 97, 0.035) 0px, transparent 50%),
      radial-gradient(at 82% 90%, rgba(201, 169, 97, 0.025) 0px, transparent 55%);
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
    font-size: 0.6875rem;
    letter-spacing: 0.16em;
    color: #8A8277;
  }

  .admin-table {
    font-size: 0.875rem;
  }
  .admin-table th {
    text-align: left;
    padding: 0.625rem 0.875rem;
    font-weight: 500;
    color: #B8AEA0;
    border-bottom: 1px solid #26231F;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .admin-table td {
    padding: 0.875rem;
    border-bottom: 1px solid rgba(38, 35, 31, 0.5);
  }
  .admin-table tbody tr {
    transition: background-color 120ms ease;
  }
  .admin-table tbody tr:hover {
    background-color: rgba(245, 241, 232, 0.02);
  }
}
```

- [ ] **Step 9: Create `apps/admin/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 10: Create `apps/admin/app/layout.tsx` (minimal bootstrap — full version comes in Task 9)**

```tsx
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'NDPI Queue — Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={jetbrains.variable}>
      <body className="min-h-screen bg-ink-900 font-sans text-paper-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 11: Create `apps/admin/app/page.tsx` (placeholder root)**

```tsx
export default function Root() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <span className="eyebrow">NDPI · Queue</span>
        <h1 className="mt-4 text-4xl font-semibold">Admin booting…</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Install deps and verify it builds**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm install
pnpm --filter @queue/admin typecheck
pnpm --filter @queue/admin dev &
sleep 6
curl -sI http://localhost:3002 | head -1
kill %1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 13: Commit**

```bash
git add apps/admin/
git commit -m "feat(admin): bootstrap Next.js 15 app with shared preset + JetBrains Mono"
```

---

### Task 7: Install shadcn/ui components

**Files:**
- Create: `apps/admin/components/ui/*.tsx` (generated via CLI)

- [ ] **Step 1: Run shadcn init non-interactively (accept defaults)**

The `components.json` already exists from Task 6, so shadcn's init is short-circuited. Add the components directly.

```bash
cd /Users/akkanat/Projects/queue-system/apps/admin
pnpm dlx shadcn@latest add button input label select sheet table badge card separator switch checkbox dropdown-menu sonner --yes
```

Expected: files created under `apps/admin/components/ui/`.

- [ ] **Step 2: Create `apps/admin/components/ui/form.tsx` manually** (shadcn's `form` requires `react-hook-form` + `@hookform/resolvers` + `zod`; we're keeping admin forms simple with native state, so skip Form and use Input/Label/Switch/Checkbox/Select directly in our components). No action required here — the file list in the file map mentions `form` but we won't use it. Proceed.

- [ ] **Step 3: Typecheck (shadcn components should build clean)**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/ui/
git commit -m "feat(admin): add shadcn/ui components (button, input, sheet, table, …)"
```

---

### Task 8: Auth store (Zustand + sessionStorage)

**Files:**
- Create: `apps/admin/store/auth-store.ts`
- Create: `apps/admin/tests/auth-store.test.ts`
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/tests/setup.ts`

- [ ] **Step 1: Create `apps/admin/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
});
```

- [ ] **Step 2: Create `apps/admin/tests/setup.ts`**

```ts
// jsdom doesn't implement sessionStorage in all envs — vitest's jsdom does,
// so this file is a place to add globals if we need them later.
export {};
```

- [ ] **Step 3: Write failing test** — `apps/admin/tests/auth-store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth-store';

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('loginSuccess stores token and flips isAuthenticated', () => {
    useAuthStore.getState().loginSuccess({
      token: 'dev.admin.123',
      username: 'admin',
      role: 'admin',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(useAuthStore.getState().username).toBe('admin');
  });

  it('logout clears state', () => {
    useAuthStore.getState().loginSuccess({
      token: 'x', username: 'admin', role: 'admin',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('isAuthenticated returns false for expired tokens', () => {
    useAuthStore.getState().loginSuccess({
      token: 'x', username: 'admin', role: 'admin',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});
```

- [ ] **Step 4: Implement `apps/admin/store/auth-store.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole, LoginResponse } from '@queue/types';

interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: number | null; // unix ms

  loginSuccess: (resp: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      role: null,
      expiresAt: null,

      loginSuccess: (resp) =>
        set({
          token: resp.token,
          username: resp.username,
          role: resp.role,
          expiresAt: new Date(resp.expires_at).getTime(),
        }),

      logout: () => set({ token: null, username: null, role: null, expiresAt: null }),

      isAuthenticated: () => {
        const s = get();
        if (!s.token || !s.expiresAt) return false;
        return s.expiresAt > Date.now();
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? (undefined as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/akkanat/Projects/queue-system/apps/admin
pnpm test
```

Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/admin/store/ apps/admin/vitest.config.ts apps/admin/tests/
git commit -m "feat(admin): auth store with Zustand + sessionStorage (tested)"
```

---

### Task 9: Providers + MSW init + root layout glue

**Files:**
- Create: `apps/admin/lib/query-client.ts`
- Create: `apps/admin/lib/msw.ts`
- Create: `apps/admin/app/providers.tsx`
- Create: `apps/admin/components/AuthGuard.tsx`
- Modify: `apps/admin/app/layout.tsx`

- [ ] **Step 1: Generate MSW service worker**

```bash
cd /Users/akkanat/Projects/queue-system/apps/admin
pnpm msw:init
```

- [ ] **Step 2: Create `apps/admin/lib/query-client.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
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

- [ ] **Step 3: Create `apps/admin/lib/msw.ts`**

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

- [ ] **Step 4: Create `apps/admin/app/providers.tsx`**

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
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">
        …
      </div>
    );
  }

  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Create `apps/admin/components/AuthGuard.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

const PUBLIC_PATHS = new Set(['/login']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.has(pathname);
    if (!isAuthed && !isPublic) {
      router.replace('/login');
      return;
    }
    if (isAuthed && pathname === '/login') {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [pathname, isAuthed, router]);

  if (!ready) return null;
  return <>{children}</>;
}
```

- [ ] **Step 6: Replace `apps/admin/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthGuard } from '@/components/AuthGuard';

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'NDPI Queue — Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={jetbrains.variable}>
      <body className="min-h-screen bg-ink-900 font-sans text-paper-100 antialiased">
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Replace `apps/admin/app/page.tsx` with a redirect stub**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export default function Root() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(isAuthed ? '/dashboard' : '/login');
  }, [isAuthed, router]);

  return null;
}
```

- [ ] **Step 8: Typecheck**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/app/ apps/admin/lib/ apps/admin/components/AuthGuard.tsx apps/admin/public/mockServiceWorker.js
git commit -m "feat(admin): providers, MSW init, AuthGuard, root layout"
```

---

### Task 10: Login page

**Files:**
- Create: `apps/admin/app/login/page.tsx`

- [ ] **Step 1: Create `apps/admin/app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';
import type { LoginResponse } from '@queue/types';

export default function LoginPage() {
  const router = useRouter();
  const loginSuccess = useAuthStore((s) => s.loginSuccess);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        toast.error('Неверные учётные данные');
        return;
      }
      const data = (await res.json()) as LoginResponse;
      loginSuccess(data);
      router.replace('/dashboard');
    } catch {
      toast.error('Сеть недоступна');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-7 rounded-2xl border border-ink-700 bg-ink-800/50 p-10 shadow-paper-lift"
      >
        <div>
          <span className="eyebrow text-brass-500">NDPI · Admin</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Вход в панель
          </h1>
          <p className="mt-2 text-sm text-ink-400">
            Демо: <code className="text-brass-400">admin / admin</code>
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Логин</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-brass-500 text-ink-900 hover:bg-brass-400"
        >
          {submitting ? '…' : 'Войти'}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify dev** — admin should open `/login` and submitting `admin/admin` should hit MSW + redirect to `/dashboard` (404 until Task 12)

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin dev &
sleep 5
curl -sI http://localhost:3002/login | head -1
kill %1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/login/
git commit -m "feat(admin): login page with fake JWT via MSW"
```

---

### Task 11: Dashboard layout (Sidebar + TopBar + route group)

**Files:**
- Create: `apps/admin/components/layout/Sidebar.tsx`
- Create: `apps/admin/components/layout/TopBar.tsx`
- Create: `apps/admin/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `apps/admin/components/layout/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Building2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard',  label: 'Обзор',      Icon: LayoutDashboard },
  { href: '/services',   label: 'Услуги',     Icon: FileText },
  { href: '/categories', label: 'Категории',  Icon: Layers },
  { href: '/counters',   label: 'Окна',       Icon: Building2 },
  { href: '/operators',  label: 'Операторы',  Icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-ink-700 bg-ink-900/80">
      <div className="flex items-center gap-3 border-b border-ink-700 px-6 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-brass-500/60 font-serif text-sm font-semibold text-brass-500">
          NP
        </div>
        <div className="leading-tight">
          <div className="eyebrow text-brass-500">NDPI</div>
          <div className="mt-1 text-sm font-medium">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-ink-700/60 text-paper-100'
                  : 'text-ink-300 hover:bg-ink-700/30 hover:text-paper-100',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-brass-400' : 'text-ink-400 group-hover:text-brass-500',
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-700 px-6 py-5 text-xs text-ink-400">
        v0.1 · phase 3
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create `apps/admin/components/layout/TopBar.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

export function TopBar() {
  const router = useRouter();
  const { username, role, logout } = useAuthStore((s) => ({
    username: s.username,
    role: s.role,
    logout: s.logout,
  }));

  function onLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/60 px-8 py-5 backdrop-blur">
      <div className="leading-tight">
        <span className="eyebrow text-brass-500">
          Ájiniyaz atındaǵı NDPI · Registrator ofisi
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{username ?? '—'}</div>
          <div className="text-xs text-ink-400">{role ?? 'guest'}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="gap-2 border-ink-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create `apps/admin/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto px-8 py-8">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/admin/components/layout/ apps/admin/app/\(dashboard\)/
git commit -m "feat(admin): sidebar + topbar + dashboard route group"
```

---

### Task 12: Dashboard page

**Files:**
- Create: `apps/admin/components/StatCard.tsx`
- Create: `apps/admin/components/HourlyLoadChart.tsx`
- Create: `apps/admin/app/(dashboard)/dashboard/page.tsx`

Note: the route-group path `(dashboard)` lives inside `app/`, and its child routes (`/dashboard`, `/services`, …) each have their own folder. So the dashboard page lives at `app/(dashboard)/dashboard/page.tsx`.

- [ ] **Step 1: Create `apps/admin/components/StatCard.tsx`**

```tsx
interface Props {
  eyebrow: string;
  value: string | number;
  unit?: string;
  hint?: string;
}

export function StatCard({ eyebrow, value, unit, hint }: Props) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
      <span className="eyebrow">{eyebrow}</span>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums text-paper-100">
          {value}
        </span>
        {unit && <span className="text-sm text-ink-400">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/admin/components/HourlyLoadChart.tsx`**

```tsx
import type { HourlyLoadPoint } from '@queue/types';

interface Props {
  data: HourlyLoadPoint[];
}

export function HourlyLoadChart({ data }: Props) {
  const max = Math.max(...data.map((d) => Math.max(d.issued, d.served)));

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="eyebrow">Загрузка по часам</span>
        <div className="flex items-center gap-4 text-xs text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brass-500" /> выдано
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink-500" /> обслужено
          </span>
        </div>
      </div>

      <div className="flex h-44 items-end gap-2">
        {data.map((d) => (
          <div key={d.hour} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-full w-full items-end gap-[3px]">
              <div
                className="w-1/2 rounded-t bg-brass-500/80"
                style={{ height: `${(d.issued / max) * 100}%` }}
                title={`Выдано: ${d.issued}`}
              />
              <div
                className="w-1/2 rounded-t bg-ink-500/70"
                style={{ height: `${(d.served / max) * 100}%` }}
                title={`Обслужено: ${d.served}`}
              />
            </div>
            <span className="font-mono text-[11px] text-ink-400">
              {String(d.hour).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/admin/app/(dashboard)/dashboard/page.tsx`**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMetrics,
  HourlyLoadPoint,
  RecentTicket,
} from '@queue/types';
import { StatCard } from '@/components/StatCard';
import { HourlyLoadChart } from '@/components/HourlyLoadChart';
import { Badge } from '@/components/ui/badge';

interface DashboardResp {
  metrics: DashboardMetrics;
  hourly: HourlyLoadPoint[];
  recent: RecentTicket[];
}

async function fetchDashboard(): Promise<DashboardResp> {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

const STATUS_LABEL: Record<string, string> = {
  waiting:   'ожидает',
  called:    'вызван',
  serving:   'обслуживается',
  served:    'обслужен',
  skipped:   'пропущен',
  cancelled: 'отменён',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow text-brass-500">Обзор</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Сегодня в офисе регистратора
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-ink-400">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard eyebrow="Талонов выдано" value={data.metrics.ticketsToday} />
            <StatCard
              eyebrow="Среднее ожидание"
              value={data.metrics.avgWaitMinutes}
              unit="мин"
            />
            <StatCard
              eyebrow="Активных окон"
              value={data.metrics.activeCounters}
              unit="/ 5"
            />
            <StatCard
              eyebrow="Обслужено"
              value={data.metrics.served}
              hint={`${Math.round((data.metrics.served / data.metrics.ticketsToday) * 100)}% от общего`}
            />
          </div>

          <HourlyLoadChart data={data.hourly} />

          <section className="rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">Последние талоны</span>
              <span className="text-xs text-ink-400">{data.recent.length} записей</span>
            </div>
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Категория</th>
                  <th>Услуга</th>
                  <th>Окно</th>
                  <th>Статус</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono font-semibold text-brass-400">{t.number}</td>
                    <td className="text-ink-300">{t.category_code}</td>
                    <td className="max-w-[340px] truncate text-paper-100">{t.service_name}</td>
                    <td className="font-mono text-ink-300">{t.counter_number ?? '—'}</td>
                    <td>
                      <Badge variant="outline" className="border-ink-600 text-ink-300">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs text-ink-400">
                      {new Date(t.issued_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + dev run**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin typecheck
pnpm --filter @queue/admin dev &
sleep 5
curl -sI http://localhost:3002/dashboard | head -1
kill %1
```

Expected: 200 OK (AuthGuard will redirect unauthed users to /login — the curl gets an HTML page either way).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/StatCard.tsx apps/admin/components/HourlyLoadChart.tsx apps/admin/app/\(dashboard\)/dashboard/
git commit -m "feat(admin): dashboard with stat cards, hourly chart, recent tickets"
```

---

### Task 13: Services page — table + filter + edit sheet

**Files:**
- Create: `apps/admin/components/ServiceEditSheet.tsx`
- Create: `apps/admin/app/(dashboard)/services/page.tsx`

- [ ] **Step 1: Create `apps/admin/components/ServiceEditSheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Service, DeliveryType } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DELIVERY_TYPES: DeliveryType[] = [
  'electron',
  'qagaz',
  'awizeki',
  'electron_qagaz',
  'electron_awizeki',
  'jiynalmali_papka',
];

interface Props {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceEditSheet({ service, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Service | null>(service);

  useEffect(() => {
    setDraft(service);
  }, [service]);

  const mutation = useMutation({
    mutationFn: async (s: Service) => {
      const res = await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Service;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Сохранено');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            Услуга #{draft.id}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Редактирование карточки услуги
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name_kaa">Название (kaa)</Label>
            <Input
              id="name_kaa"
              value={draft.name_kaa}
              onChange={(e) => setDraft({ ...draft, name_kaa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_ru">Название (ru)</Label>
            <Input
              id="name_ru"
              value={draft.name_ru}
              onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sla_days">Срок (дней)</Label>
              <Input
                id="sla_days"
                type="number"
                min={0}
                value={draft.sla_days}
                onChange={(e) =>
                  setDraft({ ...draft, sla_days: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Тип выдачи</Label>
              <Select
                value={draft.delivery_type}
                onValueChange={(v) =>
                  setDraft({ ...draft, delivery_type: v as DeliveryType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Требует визит</div>
              <div className="text-xs text-ink-400">
                Попадает в очередь в киоске
              </div>
            </div>
            <Switch
              checked={draft.requires_visit}
              onCheckedChange={(v) => setDraft({ ...draft, requires_visit: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активна</div>
              <div className="text-xs text-ink-400">
                Видна операторам и в киоске
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `apps/admin/app/(dashboard)/services/page.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Service, ServiceCategory } from '@queue/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ServiceEditSheet } from '@/components/ServiceEditSheet';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function ServicesPage() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Service | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter !== 'all' && s.category_id !== Number(categoryFilter)) return false;
      if (q && !`${s.name_kaa} ${s.name_ru}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, categoryFilter, search]);

  function codeOf(s: Service) {
    return categories.find((c) => c.id === s.category_id)?.code ?? '?';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-brass-500">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Услуги</h1>
          <p className="mt-1 text-sm text-ink-400">{services.length} записей</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} · {c.name_ru}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
        {isLoading ? (
          <div className="p-8 text-sm text-ink-400">Загрузка…</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-16">Код</th>
                <th>Название (kaa)</th>
                <th>Название (ru)</th>
                <th className="w-24">Срок</th>
                <th className="w-36">Выдача</th>
                <th className="w-28">В очереди</th>
                <th className="w-24">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(s)}
                >
                  <td className="font-mono text-xs text-ink-400">{s.id}</td>
                  <td>
                    <span className="font-mono text-sm font-semibold text-brass-400">
                      {codeOf(s)}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate">{s.name_kaa}</td>
                  <td className="max-w-[260px] truncate text-ink-300">{s.name_ru}</td>
                  <td className="font-mono text-sm">
                    {s.sla_days === 0 ? 'сразу' : `${s.sla_days} д.`}
                  </td>
                  <td className="font-mono text-xs text-ink-400">{s.delivery_type}</td>
                  <td>
                    {s.requires_visit ? (
                      <Badge className="bg-brass-500/15 text-brass-400">да</Badge>
                    ) : (
                      <Badge variant="outline" className="border-ink-600 text-ink-400">
                        нет
                      </Badge>
                    )}
                  </td>
                  <td>
                    {s.is_active ? (
                      <Badge variant="outline" className="border-ink-600 text-paper-100">
                        активна
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-ink-700 text-ink-500">
                        выкл
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ServiceEditSheet
        service={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin typecheck
git add apps/admin/components/ServiceEditSheet.tsx apps/admin/app/\(dashboard\)/services/
git commit -m "feat(admin): services list with filter, search, edit sheet"
```

---

### Task 14: Categories page — grid of cards + edit sheet

**Files:**
- Create: `apps/admin/components/CategoryEditSheet.tsx`
- Create: `apps/admin/app/(dashboard)/categories/page.tsx`

- [ ] **Step 1: Create `apps/admin/components/CategoryEditSheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ServiceCategory } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  category: ServiceCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryEditSheet({ category, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ServiceCategory | null>(category);

  useEffect(() => setDraft(category), [category]);

  const mutation = useMutation({
    mutationFn: async (c: ServiceCategory) => {
      const res = await fetch(`/api/categories/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as ServiceCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Сохранено');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            Категория {draft.code}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Редактирование карточки категории
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name_kaa">Название (kaa)</Label>
            <Input
              id="name_kaa"
              value={draft.name_kaa}
              onChange={(e) => setDraft({ ...draft, name_kaa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_ru">Название (ru)</Label>
            <Input
              id="name_ru"
              value={draft.name_ru}
              onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Цвет</Label>
              <input
                id="color"
                type="color"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-10 w-16 cursor-pointer rounded-md border border-ink-700 bg-ink-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Порядок</Label>
              <Input
                id="order"
                type="number"
                min={0}
                value={draft.order}
                onChange={(e) =>
                  setDraft({ ...draft, order: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `apps/admin/app/(dashboard)/categories/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Service, ServiceCategory } from '@queue/types';
import { CategoryEditSheet } from '@/components/CategoryEditSheet';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CategoriesPage() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });
  const [editing, setEditing] = useState<ServiceCategory | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow text-brass-500">Справочник</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Категории</h1>
        <p className="mt-1 text-sm text-ink-400">
          {categories.length} категорий · {services.length} услуг всего
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const count = services.filter((s) => s.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setEditing(c)}
                className="group relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40 p-6 text-left transition-all duration-200 hover:border-ink-600 hover:bg-ink-800/70"
              >
                <span
                  className="absolute inset-x-6 top-0 h-[3px] rounded-b-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className="eyebrow" style={{ color: c.color }}>
                    {String(c.order).padStart(2, '0')} · {c.code}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                </div>
                <div className="my-8">
                  <span
                    className="font-serif text-6xl leading-none"
                    style={{ color: '#F5F1E8', fontWeight: 400 }}
                  >
                    {c.code}
                  </span>
                </div>
                <div className="text-sm font-medium text-paper-100">{c.name_ru}</div>
                <div className="mt-1 text-xs text-ink-400">{c.name_kaa}</div>
                <div className="mt-5 border-t border-ink-700 pt-4 text-xs text-ink-400">
                  {count} услуг
                </div>
              </button>
            );
          })}
      </div>

      <CategoryEditSheet
        category={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/admin/components/CategoryEditSheet.tsx apps/admin/app/\(dashboard\)/categories/
git commit -m "feat(admin): categories page — cards + edit sheet"
```

---

### Task 15: Counters CRUD

**Files:**
- Create: `apps/admin/components/CounterEditSheet.tsx`
- Create: `apps/admin/app/(dashboard)/counters/page.tsx`

- [ ] **Step 1: Create `apps/admin/components/CounterEditSheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, Service } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  counter: Counter | null; // null = creating
  services: Service[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<Counter, 'id'> & { id?: number };

const EMPTY: Draft = {
  number: '',
  name: '',
  service_ids: [],
  is_active: true,
};

export function CounterEditSheet({ counter, services, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(counter ?? EMPTY);

  useEffect(() => {
    setDraft(counter ?? EMPTY);
  }, [counter]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/counters' : `/api/counters/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const body = isCreate ? d : d;
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Counter;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counters'] });
      toast.success(draft.id ? 'Окно обновлено' : 'Окно создано');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  function toggleService(id: number) {
    setDraft((d) => ({
      ...d,
      service_ids: d.service_ids.includes(id)
        ? d.service_ids.filter((x) => x !== id)
        : [...d.service_ids, id],
    }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {counter ? `Окно #${counter.id}` : 'Новое окно'}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Настройка рабочего места оператора
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">Номер</Label>
              <Input
                id="number"
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                className="w-24 text-center font-mono text-lg"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активно</div>
              <div className="text-xs text-ink-400">
                Участвует в распределении очереди
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Обслуживаемые услуги ({draft.service_ids.length})</Label>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-ink-700 p-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-ink-800/60"
                >
                  <Checkbox
                    checked={draft.service_ids.includes(s.id)}
                    onCheckedChange={() => toggleService(s.id)}
                  />
                  <span className="flex-1 text-sm">{s.name_ru}</span>
                  <span className="font-mono text-xs text-ink-400">#{s.id}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `apps/admin/app/(dashboard)/counters/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, Service } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CounterEditSheet } from '@/components/CounterEditSheet';

async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CountersPage() {
  const qc = useQueryClient();
  const { data: counters = [] } = useQuery({
    queryKey: ['counters'],
    queryFn: fetchCounters,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const [editing, setEditing] = useState<Counter | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/counters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counters'] });
      toast.success('Окно удалено');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-brass-500">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Окна</h1>
          <p className="mt-1 text-sm text-ink-400">{counters.length} рабочих мест</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-brass-500 text-ink-900 hover:bg-brass-400"
        >
          <Plus className="h-4 w-4" />
          Создать окно
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th className="w-20">№</th>
              <th>Название</th>
              <th className="w-32">Услуг</th>
              <th className="w-28">Статус</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {counters.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-lg font-semibold text-brass-400">
                  {c.number}
                </td>
                <td>{c.name}</td>
                <td className="font-mono text-sm text-ink-300">
                  {c.service_ids.length}
                </td>
                <td>
                  {c.is_active ? (
                    <Badge variant="outline" className="border-ink-600 text-paper-100">
                      активно
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-ink-700 text-ink-500">
                      выкл
                    </Badge>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(c)}
                      className="gap-1.5 border-ink-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Удалить окно №${c.number}?`)) {
                          deleteMut.mutate(c.id);
                        }
                      }}
                      className="gap-1.5 border-ink-600 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <CounterEditSheet
        counter={editing}
        services={services}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <CounterEditSheet
        counter={null}
        services={services}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/admin/components/CounterEditSheet.tsx apps/admin/app/\(dashboard\)/counters/
git commit -m "feat(admin): counters CRUD page (create/edit/delete)"
```

---

### Task 16: Operators CRUD

**Files:**
- Create: `apps/admin/components/OperatorEditSheet.tsx`
- Create: `apps/admin/app/(dashboard)/operators/page.tsx`

- [ ] **Step 1: Create `apps/admin/components/OperatorEditSheet.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, User, UserRole } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin',    label: 'Администратор' },
  { value: 'operator', label: 'Оператор' },
  { value: 'viewer',   label: 'Наблюдатель' },
];

interface Props {
  user: User | null;
  counters: Counter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<User, 'id'> & { id?: number };

const EMPTY: Draft = {
  username: '',
  name: '',
  role: 'operator',
  counter_id: null,
  is_active: true,
};

export function OperatorEditSheet({ user, counters, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(user ?? EMPTY);

  useEffect(() => setDraft(user ?? EMPTY), [user]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/users' : `/api/users/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as User;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(draft.id ? 'Оператор обновлён' : 'Оператор создан');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {user ? `Пользователь #${user.id}` : 'Новый оператор'}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Учётная запись для работы в системе
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Логин</Label>
            <Input
              id="username"
              value={draft.username}
              onChange={(e) =>
                setDraft({ ...draft, username: e.target.value.toLowerCase() })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Роль</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.role === 'operator' && (
            <div className="space-y-2">
              <Label>Окно</Label>
              <Select
                value={draft.counter_id ? String(draft.counter_id) : 'none'}
                onValueChange={(v) =>
                  setDraft({ ...draft, counter_id: v === 'none' ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— не назначено —</SelectItem>
                  {counters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      №{c.number} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активен</div>
              <div className="text-xs text-ink-400">
                Может входить в систему
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `apps/admin/app/(dashboard)/operators/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, User } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OperatorEditSheet } from '@/components/OperatorEditSheet';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  return res.json();
}
async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'админ',
  operator: 'оператор',
  viewer: 'наблюдатель',
};

export default function OperatorsPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: counters = [] } = useQuery({
    queryKey: ['counters'],
    queryFn: fetchCounters,
  });

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Удалено');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  function counterLabel(id: number | null) {
    if (!id) return '—';
    const c = counters.find((x) => x.id === id);
    return c ? `№${c.number}` : '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-brass-500">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Операторы</h1>
          <p className="mt-1 text-sm text-ink-400">{users.length} учётных записей</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-brass-500 text-ink-900 hover:bg-brass-400"
        >
          <Plus className="h-4 w-4" />
          Создать оператора
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th className="w-32">Логин</th>
              <th>Имя</th>
              <th className="w-36">Роль</th>
              <th className="w-24">Окно</th>
              <th className="w-28">Статус</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-sm">{u.username}</td>
                <td>{u.name}</td>
                <td className="text-ink-300">{ROLE_LABEL[u.role]}</td>
                <td className="font-mono text-sm">{counterLabel(u.counter_id)}</td>
                <td>
                  {u.is_active ? (
                    <Badge variant="outline" className="border-ink-600 text-paper-100">
                      активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-ink-700 text-ink-500">
                      выкл
                    </Badge>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(u)}
                      className="gap-1.5 border-ink-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Удалить ${u.username}?`)) deleteMut.mutate(u.id);
                      }}
                      className="gap-1.5 border-ink-600 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <OperatorEditSheet
        user={editing}
        counters={counters}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <OperatorEditSheet
        user={null}
        counters={counters}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/akkanat/Projects/queue-system
git add apps/admin/components/OperatorEditSheet.tsx apps/admin/app/\(dashboard\)/operators/
git commit -m "feat(admin): operators CRUD page (create/edit/delete)"
```

---

### Task 17: Playwright E2E smoke

**Files:**
- Create: `apps/admin/playwright.config.ts`
- Create: `apps/admin/tests/e2e/admin-smoke.spec.ts`

- [ ] **Step 1: Create `apps/admin/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Create `apps/admin/tests/e2e/admin-smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('admin happy path: login → each page loads', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Вход в панель' })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel('Логин').fill('admin');
  await page.getByLabel('Пароль').fill('admin');
  await page.getByRole('button', { name: 'Войти' }).click();

  // dashboard
  await expect(
    page.getByRole('heading', { name: /Сегодня в офисе/ }),
  ).toBeVisible({ timeout: 15_000 });

  for (const [href, heading] of [
    ['/services', /Услуги/],
    ['/categories', /Категории/],
    ['/counters', /Окна/],
    ['/operators', /Операторы/],
  ] as const) {
    await page.getByRole('link', { name: heading }).first().click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain(href);
  }

  // logout
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
```

- [ ] **Step 3: Install browsers if needed (shared with kiosk's install)**

```bash
cd /Users/akkanat/Projects/queue-system/apps/admin
pnpm exec playwright install chromium
```

- [ ] **Step 4: Run E2E**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm --filter @queue/admin test:e2e
```

Expected: 1 test PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/playwright.config.ts apps/admin/tests/e2e/
git commit -m "test(admin): Playwright smoke — login + each page"
```

---

### Task 18: Final verification + README update

**Files:**
- Modify: `README.md` (root)

- [ ] **Step 1: All checks green**

```bash
cd /Users/akkanat/Projects/queue-system
pnpm typecheck
pnpm test
(cd agent && go test ./...)
pnpm --filter @queue/admin test:e2e
```

Expected: everything PASS (kiosk vitest, mocks vitest, admin vitest, agent go, admin playwright).

- [ ] **Step 2: Update status in `README.md`**

Find the status block and change:

```diff
- - ⏳ Phase 3 — admin on mocks
+ - ✅ Phase 3 — admin on mocks (login, dashboard, services/categories/counters/operators CRUD)
```

Also update the structure tree comment:

```diff
-   admin/       # admin panel (planned)
+   admin/       # admin panel — Next.js 15, shadcn/ui, MSW-backed CRUD
```

And the Quick start section, append a second line:

```diff
 pnpm --filter @queue/kiosk dev   # http://localhost:3001
+pnpm --filter @queue/admin dev   # http://localhost:3002  (login admin/admin)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: mark Phase 3 (admin panel) complete"
```

---

## Verification Checklist

- [ ] All 18 tasks committed with descriptive messages.
- [ ] `pnpm typecheck` clean across 4 packages (types, mocks, kiosk, admin).
- [ ] `pnpm test` PASS: kiosk (10) + mocks (>= 16) + admin (4).
- [ ] `cd agent && go test ./...` PASS (27 tests).
- [ ] `pnpm --filter @queue/admin test:e2e` PASS (1 scenario).
- [ ] `pnpm --filter @queue/admin dev` serves on :3002, login flow reaches dashboard.
- [ ] Services page: editing `sla_days` + toggling `is_active` persists until the tab is refreshed.
- [ ] Categories page: changing color updates both the card stripe and the kiosk's category palette on next load.
- [ ] Counters page: creating a new counter and assigning services works; delete confirm.
- [ ] Operators page: creating a new operator appears in list; deletion confirms.
- [ ] Sidebar link highlights correctly for the current route.
- [ ] Logout button flips auth back to `/login`.

## Open Questions for Phase 4+

- **Real JWT.** Replace the stub `dev.*` token with a proper signed JWT validated on the Django side. Middleware gate can then do server-side auth properly.
- **Role-based visibility.** Today all logged-in users see all pages. Phase 4 should hide counters/operators from `operator` and `viewer` roles.
- **Live dashboard.** Dashboard metrics are fully static. Phase 5 (realtime) feeds them from Channels — swap the queryFn and keep everything else.
- **Audit log surface.** The spec calls for `AuditLog`. Admin is a natural home for a read-only "Events" page; defer to Phase 6 when the Django API produces real events.
