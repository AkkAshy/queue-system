# Phase 8 — Deploy Implementation Plan

> Written from spec §8 (deploy), §10 (risks). Produces the production deployment artifacts and validates them locally. The **live VPS rollout** (DNS, certbot, `ssh vps_prod`) is a separate, user-gated step — outward-facing and irreversible.

**Goal:** Containerise the cloud side (Django/Daphne + Postgres + Redis + the 4 Next.js frontends) behind Nginx with TLS, as a `docker compose` stack deployable to the Ubuntu VPS. The Go printer agent stays on the office mini-PC under its existing systemd unit (Phase 2). Ship a deploy runbook.

**Topology:**
```
            ┌──────────────────────── VPS (Ubuntu, Docker) ────────────────────────┐
  Internet →│  Nginx (443, TLS/certbot)                                              │
            │   ├── /            → kiosk:3001 / admin / operator / display (by host) │
            │   ├── /api/*       → backend:8000 (Daphne)                             │
            │   └── /ws/*        → backend:8000 (WebSocket upgrade)                  │
            │  backend (Daphne ASGI) ── Postgres 16 ── Redis 7                       │
            └────────────────────────────────────────────────────────────────────────┘
  Office mini-PC: Go agent (systemd) → Xprinter XP-80T;  kiosk talks to it on LAN :8089
```

---

## Decisions

- **One compose stack, host-routed.** Subdomains: `queue.<domain>` (kiosk), `admin.<domain>`, `operator.<domain>`, `tablo.<domain>`. `/api` + `/ws` proxied to the backend from every host. One wildcard-ish cert (or SAN) via certbot.
- **Nginx owns `/api` and `/ws`** → those never reach the Next apps, so the dev-only `rewrites` are inert in prod (no double-proxy). Frontends call relative `/api`; `NEXT_PUBLIC_WS_URL=wss://<host>`; `NEXT_PUBLIC_USE_MSW=0` baked at build.
- **Next standalone output** for small images (`output: 'standalone'`, gated so it doesn't affect dev).
- **Backend image runs migrate + collectstatic on start**, then `daphne config.asgi:application`. Secrets via env file (not committed).
- **Agent is NOT in the compose stack** — it lives in the office on bare metal (systemd unit already shipped). Runbook documents installing it there.
- **TLS via certbot on the host** (webroot or `--nginx`), documented; not automated in this phase (needs the real domain + DNS pointing at the VPS).
- **Local validation only here.** `docker compose config` + build the backend image + run the stack locally on HTTP (no TLS) to prove it serves. Live rollout is gated.

---

## File Map
```
backend/Dockerfile                 # python:3.13-slim, poetry, daphne entrypoint
backend/entrypoint.sh              # migrate + collectstatic + daphne
apps/<app>/Dockerfile              # node:20, next build (standalone), next start
deploy/
  docker-compose.prod.yml          # db, redis, backend, 4 frontends, nginx
  nginx/queue.conf.template        # host-routed reverse proxy + WS upgrade + TLS
  .env.prod.example                # secrets/domain template
  README.md                        # deploy runbook (VPS bootstrap → certbot → up)
```

---

## Tasks

### P8.1 — Backend image
- `backend/Dockerfile` (python:3.13-slim; install poetry; `poetry install --only main`; copy app).
- `backend/entrypoint.sh`: wait-for-db, `migrate --noinput`, `collectstatic --noinput`, exec `daphne -b 0.0.0.0 -p 8000 config.asgi:application`.
- `STATIC_ROOT` + WhiteNoise (or nginx-served) in settings; env `DATABASE_URL`/`REDIS_URL`/`SECRET_KEY`/`ALLOWED_HOSTS`/`CORS`.
- Build image locally; run against the dev PG/Redis; `curl /api/categories`. Commit.

### P8.2 — Frontend images + standalone
- Add `output: 'standalone'` to each `next.config.mjs` (kept harmless in dev).
- `apps/<app>/Dockerfile` (multi-stage: deps → build with `NEXT_PUBLIC_USE_MSW=0` + `NEXT_PUBLIC_WS_URL` build args → runner `node server.js`). Monorepo-aware (copy workspace + standalone trace).
- Build one image (kiosk) locally to prove the Dockerfile. Commit.

### P8.3 — Compose + Nginx + env template
- `deploy/docker-compose.prod.yml`: postgres:16, redis:7, backend (depends_on, env_file), 4 frontends (build args), nginx (mounts conf + certs, 80/443).
- `deploy/nginx/queue.conf.template`: per-host server blocks, `/api` + `/ws` → backend (with `Upgrade`/`Connection` headers for WS), `/` → the host's Next app, gzip, security headers, ACME challenge location.
- `deploy/.env.prod.example`: DOMAIN, SECRET_KEY, POSTGRES_*, DATABASE_URL, REDIS_URL, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS.
- `docker compose -f deploy/docker-compose.prod.yml config` validates. Commit.

### P8.4 — Local stack smoke (HTTP, no TLS)
- Bring the stack up locally (override nginx to plain :80, or hit services directly): backend migrates + seeds, a frontend loads, `/api` + `/ws` work end-to-end through nginx.
- Capture proof. Tear down. Commit any fixes.

### P8.5 — Deploy runbook + README
- `deploy/README.md`: VPS bootstrap (Docker install, clone, `.env.prod`), DNS A-records, `certbot` cert issuance, `docker compose up -d`, `load_services_fixture`, agent install on the office PC (link to `agent/systemd`), health checks, update flow (ties into the `/deploy` skill).
- Root README: mark Phase 8 ✅ (artifacts ready), note live rollout is operator-run.
- Commit + push.

> **Gated step (not in this phase's automation):** the actual `ssh vps_prod` rollout — DNS, certbot issuing public certs, exposing services — runs only on explicit user go-ahead with the real domain.

---

## Verification Checklist
- [ ] `docker compose -f deploy/docker-compose.prod.yml config` parses cleanly.
- [ ] Backend image builds; container migrates + serves `/api` against PG/Redis.
- [ ] At least one frontend image builds (standalone) and serves.
- [ ] Local stack: a frontend loads, `/api` returns data, `/ws` upgrades + pushes.
- [ ] Runbook is complete enough to roll out from a fresh VPS.
- [ ] Nothing secret committed (`.env.prod` gitignored; only `.example`).

## Open Questions (need from Kanat before live rollout)
- **Domain.** Real hostname(s)? (spec example: `queue.ndpi.uz`). Single domain + subdomains, or paths?
- **VPS.** `ssh vps_prod` is the target? Resources (the spec budgets 2 CPU / 4 GB)?
- **TLS.** Let's Encrypt via certbot (needs public DNS → VPS) — confirm domain is delegated.
- **Office network.** Kiosk → agent on LAN (`http://<agent-ip>:8089`) or agent reachable how from the kiosk browser?
