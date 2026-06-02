# Phase 6 — Django 6 API (replace mocks) Implementation Plan

> Written from `docs/superpowers/specs/2026-04-20-queue-system-design.md` §6 (data model), §8 (phase 6), §7 (events — schema only, realtime is Phase 7). Executed task-by-task with atomic commits and tests (pytest-django).

**Goal:** Stand up a Django 6 + DRF backend in `backend/` that serves the **exact same `/api/...` contract** the 4 frontends already consume via MSW, backed by PostgreSQL. Swap each frontend off MSW onto the real API. After this phase the system runs end-to-end on a real database; realtime (Channels) is still Phase 7.

**Core principle — contract parity.** The frontends and `packages/mocks` already define the API shape (snake_case JSON, specific paths). The backend must match byte-for-byte so frontends switch with only an MSW-off toggle. The MSW handlers in `packages/mocks/src/handlers.ts` are the executable spec.

---

## Decisions (spec defaults — override if you disagree)

- **Package manager: Poetry** (per spec). `uv` is available too but we follow the design doc.
- **Dev DB: the local Postgres 14 already running on :5432** (spec targets PG 16 for prod via Docker in Phase 8 — 14 is fine for dev). DB `queue_system`.
- **Python 3.14** (installed). Django 6.0, DRF, djangorestframework-simplejwt, drf-spectacular, psycopg[binary], django-cors-headers, django-environ.
- **Custom User model** (`accounts.User` extends `AbstractUser`) with `role` (admin|operator|viewer), `name` (single display name, matches contract), `counter` (nullable FK). Avoids a second profile table; SimpleJWT authenticates against it.
- **Auth response shape matches the frontend**, not raw SimpleJWT: `POST /api/auth/login` → `{ token, username, role, expires_at }` (token = access JWT). Refresh handled internally / ignored for now.
- **Number generation**: per `category.code`, daily reset, `unique(number, created_at::date)`. Concurrency-safe via `select_for_update` on a per-day counter row (Redis INCR is a Phase 7 optimisation).
- **Frontend switch**: add `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) and `NEXT_PUBLIC_USE_MSW` (default `1` in dev). When MSW is off, fetches hit the Django origin; CORS allows :3001–:3004.

---

## App layout

```
backend/
├── pyproject.toml / poetry.lock
├── manage.py
├── .env.example
├── config/              # project: settings, urls, asgi/wsgi
│   ├── settings.py
│   ├── urls.py
│   └── ...
├── accounts/            # User (custom), auth views
├── catalog/             # ServiceCategory, Service
├── queue_app/           # Counter, Ticket, OperatorSession, queue logic, dashboard, display
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   ├── services.py      # number generation, call-next fairness
│   └── management/commands/load_services_fixture.py
└── tests/               # pytest-django
```

---

## Tasks

### Task 1 — Bootstrap Django project
- `poetry init` + deps (django, djangorestframework, djangorestframework-simplejwt, drf-spectacular, psycopg[binary], django-cors-headers, django-environ, pytest-django, pytest, model-bakery).
- `config` project, apps `accounts`/`catalog`/`queue_app`.
- `settings.py` env-driven (DB, SECRET_KEY, DEBUG, CORS origins :3001–3004, INSTALLED_APPS, DRF defaults, SimpleJWT, spectacular).
- `.env.example`, `.gitignore` (venv, __pycache__, .env, *.sqlite3).
- `createdb queue_system`; `manage.py check`. Commit.

### Task 2 — accounts.User (custom) + migration
- `AbstractUser` + `role`, `name`, `counter` (FK set null, added after Counter exists → use string ref / nullable, or add FK in Task 3 migration). `AUTH_USER_MODEL = 'accounts.User'`.
- Migration. `createsuperuser` smoke. Commit.

### Task 3 — catalog models (ServiceCategory, Service) + Counter
- `ServiceCategory(code, name_kaa, name_ru, color, order)`, `Service(category FK, name_kaa, name_ru, sla_days, delivery_type, requires_visit, is_active)`.
- `Counter(number, name, service_ids JSON or M2M to Service, is_active)` — contract uses `service_ids: number[]`; model as `ManyToMany(Service)` but **serialize as `service_ids` list** to match contract. Wire `User.counter` FK now.
- Migrations + Django admin registrations. Commit.

### Task 4 — queue_app models (Ticket, OperatorSession) + number service
- `Ticket(number, category FK, service FK null, status, counter FK null, operator FK null, created_at, called_at)`; `status` choices match `TicketStatus`.
- `OperatorSession(user FK, counter FK, status, started_at, ended_at)`.
- `services.py`: `next_number(category)` (daily per-code counter, `select_for_update`), `call_next(counter, operator)` (oldest waiting among counter's eligible services), transitions.
- Migrations + unit tests for number gen + call-next fairness (pytest). Commit.

### Task 5 — seed command
- `load_services_fixture` reads the JSON fixtures from `packages/mocks/src/fixtures/*` (categories, services, counters, users) — single source of truth. Idempotent (update_or_create). Seeds a default admin (admin/admin) + operators.
- Run it; verify counts (9 cats, 65 services, 5 counters). Commit.

### Task 6 — auth + DRF base
- SimpleJWT; custom `POST /api/auth/login` returning `{ token, username, role, expires_at }`. Permission scheme: default IsAuthenticated, but kiosk/display/login endpoints AllowAny (kiosk creates tickets without login; display is public; catalog GET public).
- Commit.

### Task 7 — catalog endpoints
- `GET /api/categories`, `PATCH /api/categories/:id`; `GET /api/services?category_id=`, `PATCH /api/services/:id`. Serializers match contract field names exactly.
- pytest for shapes. Commit.

### Task 8 — counters + users CRUD
- `GET/POST /api/counters`, `PATCH/DELETE /api/counters/:id` (serialize `service_ids`).
- `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` (role, counter_id, is_active; create sets a default password).
- pytest. Commit.

### Task 9 — tickets create + dashboard
- `POST /api/tickets` with `idempotency_key` (dedupe table or cache), returns Ticket; assigns `number` via service.
- `GET /api/dashboard` computes `{ ticketsToday, avgWaitMinutes, activeCounters, served }` (+ hourly + recent if the admin uses them — match the MSW `dashboard.json` shape).
- pytest. Commit.

### Task 10 — operator endpoints
- `POST /api/operator-sessions`, `PATCH /api/operator-sessions/:id`.
- `GET /api/queue?counter_id=`, `GET /api/tickets/current?counter_id=`.
- `POST /api/tickets/call-next`, `/:id/finish`, `/:id/skip`, `/:id/transfer`.
- Reuse `services.py` logic. pytest covering call-next fairness + transitions over HTTP. Commit.

### Task 11 — display endpoint + OpenAPI
- `GET /api/display/active` → `DisplayCall[]` (join counter, newest first, cap 12).
- drf-spectacular: `/api/schema`, `/api/docs`. Verify schema generates.
- pytest. Commit.

### Task 12 — frontend integration (MSW → real API)
- Add `NEXT_PUBLIC_USE_MSW` gate to each app's `lib/msw.ts` (skip worker.start when '0') and ensure fetches use `NEXT_PUBLIC_API_URL` base (or rely on same-origin proxy / absolute base). Simplest: prefix API calls with `process.env.NEXT_PUBLIC_API_URL ?? ''` so MSW-mode ('' → same origin) and real-mode (`http://localhost:8000`) both work.
- Run Django + each frontend with MSW off; smoke the happy paths (kiosk ticket, admin login+lists, operator call→finish, display board) against the real DB.
- CORS confirmed. Commit per app or together.

### Task 13 — final verification + README + dev compose
- `pytest` green; `manage.py check --deploy` sane; `pnpm typecheck`/`test`/e2e still green (e2e stays on MSW).
- `docker-compose.dev.yml` for Postgres (optional; documents prod PG16).
- README: mark Phase 6 ✅, add backend quick start (poetry install, migrate, seed, runserver) + the MSW toggle. Commit.

---

## Verification Checklist
- [ ] `poetry run pytest` green (models, number-gen, all endpoints).
- [ ] `manage.py load_services_fixture` → 9 categories, 65 services, 5 counters, admin + operators.
- [ ] Every MSW path has a matching Django route with identical JSON shape.
- [ ] With `NEXT_PUBLIC_USE_MSW=0`: kiosk issues a ticket persisted in PG; admin login (admin/admin) + lists load; operator call→finish mutates DB; display shows live calls.
- [ ] `/api/docs` renders the OpenAPI schema.
- [ ] Frontend MSW-mode (default) still works unchanged; all e2e suites green.

## Open Questions for Phase 7+
- **Realtime.** Wrap mutations (`call-next`, `finish`, transfer, ticket.created) in Channels broadcasts to `display:*`, `operator:*`, `admin:dashboard`, `agent:office`.
- **Number-gen at scale.** Swap `select_for_update` per-day counter for Redis `INCR`.
- **Agent print over cloud.** `agent:office` channel receives print jobs instead of the kiosk POSTing `localhost:8089` directly.
- **TOTP for admin** (spec §9.1 default).
