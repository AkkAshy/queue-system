import { http, HttpResponse } from 'msw';
import categoriesSeed from './fixtures/categories.json';
import servicesSeed from './fixtures/services.json';
import countersSeed from './fixtures/counters.json';
import usersSeed from './fixtures/users.json';
import dashboardSeed from './fixtures/dashboard.json';
import queueSeed from './fixtures/queue-seed.json';
import displaySeed from './fixtures/display-seed.json';
import { TicketStore } from './ticket-store';
import { CategoryStore } from './category-store';
import { ServiceStore } from './service-store';
import { CounterStore } from './counter-store';
import { UserStore } from './user-store';
import { OperatorSessionStore } from './operator-session-store';
import type {
  CreateTicketRequest,
  ServiceCategory,
  Counter,
  User,
  LoginRequest,
  DisplayCall,
  DisplayBoardWindow,
} from '@queue/types';

// Module-level singletons — the MSW service worker holds their state for the
// entire session. Each app that runs MSW has its own SW → independent state.
import type { Service } from '@queue/types';
const categories = new CategoryStore(categoriesSeed as ServiceCategory[]);
const servicesStore = new ServiceStore(servicesSeed as unknown as Service[]);
const counters = new CounterStore(countersSeed as unknown as Counter[]);
const users = new UserStore(usersSeed as unknown as User[]);
const tickets = new TicketStore();
const sessions = new OperatorSessionStore();

// Pre-populate the queue so operators have something to call in demos.
// Cast through unknown because JSON types look structurally compatible but
// TS can't infer this statically.
tickets.seedWaiting(queueSeed as unknown as Parameters<typeof tickets.seedWaiting>[0]);
// A few already-called tickets so the waiting-hall board has content on first load.
tickets.seedCalled(displaySeed as unknown as Parameters<typeof tickets.seedCalled>[0]);

// Board settings (YouTube URL set from the admin app). Sample clip for demos.
let displaySettings = { youtube_url: 'https://youtu.be/aqz-KE-bpKQ' };

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

  http.post('/api/categories', async ({ request }) => {
    const body = (await request.json()) as Omit<ServiceCategory, 'id'>;
    return HttpResponse.json(categories.create(body), { status: 201 });
  }),

  http.patch('/api/categories/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Record<string, unknown>;
    const updated = categories.update(id, patch);
    if (!updated) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.delete('/api/categories/:id', ({ params }) => {
    const ok = categories.remove(Number(params.id));
    if (!ok) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return new HttpResponse(null, { status: 204 });
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

  http.post('/api/services', async ({ request }) => {
    const body = (await request.json()) as Omit<Service, 'id'>;
    return HttpResponse.json(servicesStore.create(body), { status: 201 });
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

  http.delete('/api/services/:id', ({ params }) => {
    const ok = servicesStore.remove(Number(params.id));
    if (!ok) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return new HttpResponse(null, { status: 204 });
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

  // ---------- display board ----------
  http.get('/api/display/active', () => {
    const calls: DisplayCall[] = tickets
      .activeCalls()
      .flatMap((t) => {
        if (t.counter_id === null) return [];
        const counter = counters.get(t.counter_id);
        if (!counter) return [];
        return [
          {
            id: t.id,
            number: t.number,
            category_id: t.category_id,
            counter_id: t.counter_id,
            counter_number: counter.number,
            counter_name: counter.name,
            called_at: t.called_at ?? t.created_at,
            status: (t.status === 'serving' ? 'serving' : 'called') as
              | 'called'
              | 'serving',
          },
        ];
      })
      .slice(0, 12);
    return HttpResponse.json(calls);
  }),

  // all active windows + their current call (null when idle) — powers the strip
  http.get('/api/display/board', () => {
    const active = tickets.activeCalls();
    const board: DisplayBoardWindow[] = counters
      .list()
      .filter((c) => c.is_active !== false)
      .map((counter) => {
        const t = active.find((x) => x.counter_id === counter.id) ?? null;
        const current: DisplayCall | null = t
          ? {
              id: t.id,
              number: t.number,
              category_id: t.category_id,
              counter_id: counter.id,
              counter_number: counter.number,
              counter_name: counter.name,
              called_at: t.called_at ?? t.created_at,
              status: (t.status === 'serving' ? 'serving' : 'called') as
                | 'called'
                | 'serving',
            }
          : null;
        return {
          counter_id: counter.id,
          counter_number: counter.number,
          counter_name: counter.name,
          current,
        };
      });
    return HttpResponse.json(board);
  }),

  // waiting queue (issued, not yet called) — shown on the board
  http.get('/api/display/waiting', () => {
    const waiting = tickets
      .list()
      .filter((t) => t.status === 'waiting')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 20)
      .map((t) => ({ id: t.id, number: t.number, category_id: t.category_id }));
    return HttpResponse.json(waiting);
  }),

  // board settings — GET for the board, PATCH from the admin app
  http.get('/api/display/settings', () => HttpResponse.json(displaySettings)),
  http.patch('/api/display/settings', async ({ request }) => {
    const body = (await request.json()) as Partial<typeof displaySettings>;
    displaySettings = { ...displaySettings, ...body };
    return HttpResponse.json(displaySettings);
  }),
];
