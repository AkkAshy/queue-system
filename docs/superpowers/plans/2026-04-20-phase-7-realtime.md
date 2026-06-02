# Phase 7 — Realtime (Channels + Redis) Implementation Plan

> Written from spec §7 (real-time). Executed task-by-task with atomic commits + tests.

**Goal:** Push queue changes to the frontends instantly over WebSocket instead of (only) 2–3 s polling. An operator presses "Вызвать" → the display board, other operators, and the admin dashboard update in <1 s. Polling stays as the fallback when WS is down.

**Architecture:** Add Django Channels + Redis channel layer to the existing backend. A single `RealtimeConsumer` joins one of three groups based on the WS path (`/ws/display`, `/ws/operator`, `/ws/admin`). Every ticket mutation view broadcasts a lightweight `{event: "..."}` message to the affected groups via a `realtime.broadcast()` helper. Frontends open a WS (only in real-API mode, `NEXT_PUBLIC_USE_MSW=0`) and on any message **invalidate the relevant TanStack Query keys** — reusing all existing fetch logic; the socket is just a smarter refetch trigger. Polling intervals stay but lengthen (WS is primary, poll is the safety net).

**Tech:** channels 4, channels-redis, daphne (ASGI). Redis 8 already running locally. WebsocketCommunicator for tests.

---

## Decisions

- **3 groups, not per-id channels (yet).** `display`, `operators`, `admin`. The spec's `display:<counter_id>` / `operator:<user_id>` granularity is a refinement parked for later — at office scale (5 counters) a coarse broadcast + client-side query invalidation is simpler and correct. Noted in Open Questions.
- **Broadcast from the view layer**, not `services.py`, so the pure domain unit tests stay synchronous and side-effect-free.
- **WS only in real-API mode.** In MSW mode there is no Django server; the hook no-ops and polling carries the app. Gate on `NEXT_PUBLIC_USE_MSW !== '0'` → skip… actually connect only when `=== '0'`.
- **Message = trigger, not payload.** Clients refetch on message rather than trusting pushed data — avoids cache-coherence bugs and keeps the contract single-sourced in REST.
- **`agent:office` channel** (print/voice push) is deferred to Phase 8 (deploy) when the agent talks to the cloud; this phase covers display/operator/admin.

---

## Tasks

### P7.1 — Channels + Redis ASGI wiring
- Add deps: `channels`, `channels-redis`, `daphne`.
- `INSTALLED_APPS`: prepend `daphne`, add `channels`. `ASGI_APPLICATION = "config.asgi.application"`. `CHANNEL_LAYERS` → Redis (`REDIS_URL`, default `redis://localhost:6379/0`).
- `config/asgi.py`: `ProtocolTypeRouter({http, websocket: AuthMiddlewareStack(URLRouter(ws_urlpatterns))})`.
- Smoke: `runserver` boots via ASGI/Daphne; `manage.py check`. Commit.

### P7.2 — RealtimeConsumer + routing
- `queue_app/consumers.py`: `RealtimeConsumer(AsyncWebsocketConsumer)` — derive group from `scope["url_route"]` (display/operators/admin), `group_add` on connect, accept, `group_discard` on disconnect, and a handler `def broadcast(event)` → `send_json({event})`.
- `config/ws.py` (or `queue_app/routing.py`): paths `ws/display`, `ws/operator`, `ws/admin`.
- Test (pytest + `WebsocketCommunicator`): connect, `group_send`, assert message received. Commit.

### P7.3 — broadcast helper + wire mutations
- `queue_app/realtime.py`: `broadcast(groups: list[str], event: str)` via `async_to_sync(get_channel_layer().group_send)`. No-op if no channel layer.
- Call from views after commit:
  - ticket create → `["operators", "admin"]` (`ticket.created`)
  - call-next → `["display", "operators", "admin"]` (`ticket.called`)
  - finish → `["display", "operators", "admin"]` (`ticket.finished`)
  - skip → `["display", "operators", "admin"]` (`ticket.skipped`)
  - transfer → `["display", "operators", "admin"]` (`ticket.transferred`)
- Test: hit `call-next` over HTTP (or call broadcast) → a connected display communicator receives `ticket.called`. Commit.

### P7.4 — frontend WS hook
- Shared pattern per app: `lib/useRealtime.ts` — opens `new WebSocket(NEXT_PUBLIC_WS_URL + path)` only when `NEXT_PUBLIC_USE_MSW === '0'`; on message → `queryClient.invalidateQueries(keys)`; auto-reconnect with backoff; cleanup on unmount.
- Wire:
  - display → `ws/display`, invalidate `['display-active']`. Lengthen poll to 10 s (fallback).
  - operator → `ws/operator`, invalidate `['current']` + `['queue']`. Poll fallback 10 s.
  - admin dashboard → `ws/admin`, invalidate `['dashboard']`.
- `NEXT_PUBLIC_WS_URL` default `ws://localhost:8000`. Typecheck. Commit.

### P7.5 — end-to-end verify + README
- Run Django (Daphne) + display + operator with `USE_MSW=0`; operator calls a ticket → board hero updates within ~1 s **without** waiting for the poll. Capture proof.
- `poetry run pytest` green; frontend typecheck/test/e2e (MSW) green.
- README: mark Phase 7 ✅, document WS env + Redis prerequisite. Commit + push.

---

## Verification Checklist
- [ ] `runserver` serves both HTTP and WS (Daphne).
- [ ] `pytest` green incl. consumer + broadcast tests.
- [ ] Operator `call-next` → display board updates in <1 s over WS (poll disabled to prove it).
- [ ] WS drop → app keeps working on the polling fallback; reconnects automatically.
- [ ] MSW mode unaffected (no WS attempted); all e2e green.

## Open Questions for later
- **Per-id targeting.** `display:<counter_id>` + `operator:<user_id>` once multi-office / many-counter scale demands it.
- **Push payloads.** Send the changed ticket in the event to skip the refetch round-trip (needs careful cache merging).
- **`agent:office`.** Print/voice commands pushed to the Go agent over WS (Phase 8).
- **Auth on WS.** Token in query/subprotocol once REST auth is enforced.
