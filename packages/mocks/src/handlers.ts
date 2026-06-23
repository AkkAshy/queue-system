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
import { ScheduleStore, WEEKDAY_LABELS, type ScheduleRow } from './schedule-store';
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
const schedules = new ScheduleStore();

/** Enrich a raw shift row with the denormalised labels the API returns. */
function enrichSchedule(row: ScheduleRow) {
  const u = users.list().find((x) => x.id === row.user_id);
  const c = counters.list().find((x) => x.id === row.counter_id);
  return {
    ...row,
    user_name: u ? u.name || u.username : `#${row.user_id}`,
    counter_number: c ? c.number : String(row.counter_id),
    hall_id: c?.hall_id ?? null,
    weekday_label: WEEKDAY_LABELS[row.weekday],
  };
}

// Pre-populate the queue so operators have something to call in demos.
// Cast through unknown because JSON types look structurally compatible but
// TS can't infer this statically.
tickets.seedWaiting(queueSeed as unknown as Parameters<typeof tickets.seedWaiting>[0]);
// A few already-called tickets so the waiting-hall board has content on first load.
tickets.seedCalled(displaySeed as unknown as Parameters<typeof tickets.seedCalled>[0]);

// Board settings (YouTube URL set from the admin app). Sample clip for demos.
let displaySettings = {
  youtube_url: 'https://youtu.be/aqz-KE-bpKQ',
  org_name: 'Ájiniyaz atındaǵı NMPI',
  ticker_text: '',
  voice_enabled: true,
  voice_lang: 'ru-RU',
};

// Halls (zaly). Seeded catalog all belongs to hall 1; hall 2 is empty for now.
const HALLS = [
  { id: 1, code: '1', name_kaa: '1-zal', name_ru: 'Зал 1 — услуги', name_uz: '1-zal — xizmatlar', name_en: 'Hall 1 — services', is_active: true, order: 1 },
  { id: 2, code: '2', name_kaa: '2-zal', name_ru: 'Зал 2 — справки', name_uz: '2-zal — ma\'lumotnomalar', name_en: 'Hall 2 — certificates', is_active: true, order: 2 },
];

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
      user_id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      counter_id: user.counter_id ?? null,
      hall_id: null,
      expires_at: expiresAt.toISOString(),
    });
  }),

  // ---------- halls ----------
  http.get('/api/halls', () => HttpResponse.json(HALLS)),
  http.post('/api/halls/:id/reset', () =>
    HttpResponse.json({ ok: true, cancelled: 0 }),
  ),

  // ---------- categories ----------
  http.get('/api/categories', ({ request }) => {
    const hallId = new URL(request.url).searchParams.get('hall_id');
    let list = categories.list().map((c) => ({ ...c, hall_id: c.hall_id ?? 1 }));
    if (hallId) list = list.filter((c) => c.hall_id === Number(hallId));
    return HttpResponse.json(list);
  }),

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

  // ---------- stats (Phase E) ----------
  http.get('/api/stats', () => {
    const all = tickets.list();
    return HttpResponse.json({
      issued: all.length,
      served: all.filter((t) => t.status === 'served').length,
      skipped: all.filter((t) => t.status === 'skipped').length,
      avg_wait_minutes: 3,
      avg_service_minutes: 5,
      peak_hour: 11,
      hourly: [],
    });
  }),
  http.get('/api/stats/export', () =>
    new HttpResponse('number,hall,category,status\nA-001,Зал 1,A,served\n', {
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    }),
  ),

  // ---------- audit (Phase G) ----------
  http.get('/api/audit', ({ request }) => {
    const action = new URL(request.url).searchParams.get('action');
    const now = Date.now();
    const sample = [
      { id: 3, actor_id: null, actor_label: '2', action: 'ticket.called', target: 'A-012', meta: { counter: '1' }, created_at: new Date(now - 60000).toISOString() },
      { id: 2, actor_id: null, actor_label: '3', action: 'ticket.finished', target: 'B-004', meta: {}, created_at: new Date(now - 180000).toISOString() },
      { id: 1, actor_id: 1, actor_label: 'admin', action: 'auth.login', target: 'admin', meta: {}, created_at: new Date(now - 600000).toISOString() },
    ];
    return HttpResponse.json(action ? sample.filter((s) => s.action === action) : sample);
  }),

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

  // ---------- work schedule (recurring shifts) ----------
  http.get('/api/schedule/current', () => {
    const now = new Date();
    // JS getDay(): 0=Sun..6=Sat → convert to Python weekday (0=Mon..6=Sun).
    const weekday = (now.getDay() + 6) % 7;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;
    const onDuty = schedules
      .list()
      .filter(
        (r) =>
          r.is_active &&
          r.weekday === weekday &&
          r.start_time <= hhmm &&
          hhmm < r.end_time,
      )
      .map(enrichSchedule);
    return HttpResponse.json(onDuty);
  }),

  http.get('/api/schedule', ({ request }) => {
    const url = new URL(request.url);
    const weekday = url.searchParams.get('weekday');
    let rows = schedules.list();
    if (weekday !== null && weekday !== '') {
      rows = rows.filter((r) => r.weekday === Number(weekday));
    }
    return HttpResponse.json(rows.map(enrichSchedule));
  }),

  http.post('/api/schedule', async ({ request }) => {
    const body = (await request.json()) as {
      weekdays?: number[];
      user_ids?: number[];
      weekday?: number; // legacy single-row shape
      user_id?: number;
      counter_id?: number; // optional explicit window (legacy)
      start_time: string;
      end_time: string;
      is_active?: boolean;
    };
    const weekdays = body.weekdays ?? (body.weekday != null ? [body.weekday] : []);
    const userIds = body.user_ids ?? (body.user_id != null ? [body.user_id] : []);
    const { start_time, end_time } = body;
    const is_active = body.is_active ?? true;

    if (!weekdays.length)
      return HttpResponse.json({ weekdays: ['Выберите хотя бы один день'] }, { status: 400 });
    if (!userIds.length)
      return HttpResponse.json({ user_ids: ['Выберите хотя бы одного оператора'] }, { status: 400 });
    if (!start_time || !end_time)
      return HttpResponse.json({ start_time: ['Укажите время начала и конца'] }, { status: 400 });
    if (start_time >= end_time)
      return HttpResponse.json({ end_time: ['Конец смены должен быть позже начала'] }, { status: 400 });

    // Upsert the operators × weekdays matrix; each operator's window comes from
    // their profile unless an explicit counter_id is given (legacy path).
    const created: ScheduleRow[] = [];
    let updated = 0;
    const no_counter: number[] = [];
    for (const uid of userIds) {
      const u = users.list().find((x) => x.id === uid);
      const counterId = body.counter_id ?? u?.counter_id ?? null;
      if (!counterId) {
        no_counter.push(uid);
        continue;
      }
      for (const wd of weekdays) {
        const existing = schedules.findSlot(uid, counterId, wd as ScheduleRow['weekday']);
        if (existing) {
          schedules.update(existing.id, { start_time, end_time, is_active });
          updated += 1;
        } else {
          created.push(
            schedules.create({
              user_id: uid,
              counter_id: counterId,
              weekday: wd as ScheduleRow['weekday'],
              start_time,
              end_time,
              is_active,
            }),
          );
        }
      }
    }
    return HttpResponse.json(
      { created: created.map(enrichSchedule), updated, no_counter },
      { status: 201 },
    );
  }),

  http.patch('/api/schedule/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = (await request.json()) as Partial<ScheduleRow>;
    const updated = schedules.update(id, patch);
    if (!updated) return HttpResponse.json({ error: 'not found' }, { status: 404 });
    return HttpResponse.json(enrichSchedule(updated));
  }),

  http.delete('/api/schedule/:id', ({ params }) => {
    const ok = schedules.remove(Number(params.id));
    return ok
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json({ error: 'not found' }, { status: 404 });
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
    const body = (await request.json()) as {
      counter_id: number;
      operator_id: number;
      ticket_id?: string;
    };
    const counter = counters.get(body.counter_id);
    if (!counter) {
      return HttpResponse.json({ error: 'unknown counter' }, { status: 404 });
    }
    const t = tickets.callNext({
      counter_id: body.counter_id,
      operator_id: body.operator_id,
      service_ids: counter.service_ids,
      ticket_id: body.ticket_id,
    });
    if (!t) {
      return HttpResponse.json(
        { error: body.ticket_id ? 'ticket not callable' : 'queue empty' },
        { status: 409 },
      );
    }
    return HttpResponse.json(t);
  }),

  http.post('/api/tickets/:id/recall', ({ params }) => {
    const t = tickets.recall(String(params.id));
    if (!t) return HttpResponse.json({ error: 'not found' }, { status: 404 });
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
