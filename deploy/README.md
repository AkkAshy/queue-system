# Deploy — NDPI Queue (cloud side)

Production stack: **Django/Daphne + Postgres + Redis + 4 Next.js apps + Nginx**, as one
`docker compose` project. The Go printer **agent runs in the office** on a mini-PC under
systemd (see [`../agent/systemd`](../agent/systemd)), not here.

Validated locally end-to-end (build → migrate → seed → per-host routing → ticket flow
through Nginx/TLS). Live rollout below is operator-run.

## Prerequisites
- Ubuntu VPS (spec budget: 2 CPU / 4 GB), Docker + Docker Compose plugin.
- A domain with DNS **A-records** → the VPS for: `queue.`, `admin.`, `operator.`, `tablo.` `<DOMAIN>`.
- Ports 80 + 443 open.

## 1. Clone + configure
```bash
git clone git@github.com:AkkAshy/queue-system.git
cd queue-system/deploy
cp .env.prod.example .env.prod
# edit .env.prod: real DOMAIN, a long random SECRET_KEY, strong POSTGRES_PASSWORD,
# matching DATABASE_URL, ALLOWED_HOSTS + CORS for your subdomains. Keep SEED_ON_START=1
# for the first boot, then set it to 0.
```

## 2. TLS certificates (Let's Encrypt / certbot)
```bash
mkdir -p certbot/www certbot/conf
# Render the Nginx config with your domain:
DOMAIN=<your-domain> envsubst '$DOMAIN' < nginx/queue.conf.template > nginx/queue.conf

# Issue certs (webroot). One cert covering all four subdomains:
docker run --rm -p 80:80 \
  -v "$PWD/certbot/conf:/etc/letsencrypt" -v "$PWD/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --standalone \
  -d queue.<DOMAIN> -d admin.<DOMAIN> -d operator.<DOMAIN> -d tablo.<DOMAIN> \
  --email you@example.com --agree-tos --no-eff-email
# (The compose Nginx expects certs under certbot/conf/live/queue.<DOMAIN>/.)
```
> Renewal: `certbot renew` on a cron/systemd-timer + `docker compose exec nginx nginx -s reload`.

## 3. Bring up the stack
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # watch migrate + seed
```
First boot: the backend waits for Postgres, migrates, and (SEED_ON_START=1) seeds
9 categories / 65 services / 5 counters / `admin`/`admin`. **Change the admin password**
and set `SEED_ON_START=0` afterwards.

## 4. Health checks
```bash
curl -sI https://queue.<DOMAIN>/            # kiosk
curl -s  https://queue.<DOMAIN>/api/categories | head   # API via Nginx → backend
# operator → display realtime: call a ticket, watch tablo update <1s
```
- API docs: `https://admin.<DOMAIN>/api/docs`

## 5. Office printer agent (separate machine)
On the office mini-PC next to the Xprinter XP-80T:
```bash
# build/copy the binary, then:
sudo cp agent/dist/ndpi-queue-agent /usr/local/bin/
sudo cp agent/systemd/ndpi-queue-agent.service /etc/systemd/system/
sudo useradd -r ndpi-agent 2>/dev/null || true
sudo systemctl enable --now ndpi-queue-agent
```
The kiosk reaches it on the LAN at `http://<agent-ip>:8089` (set `NEXT_PUBLIC_AGENT_URL`
when building/serving the kiosk, or run the kiosk on the same machine).

## 6. Updates
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# migrations run automatically on backend start
```
(The `/deploy` skill automates pull + rebuild + restart + health check.)

## Shared-host variant (single domain, path-routed, existing host nginx)

For a VPS that already runs nginx + other sites (e.g. the `avtoxizmet.uz` box),
use `docker-compose.host.yml`: services bind to `127.0.0.1` free ports
(backend 8210, kiosk 3210, admin 3211, operator 3212, display 3213), and the
HOST nginx serves one vhost `nmpi.avtoxizmet.uz` with **path routing**
(`/`=kiosk, `/admin`, `/operator`, `/tablo`, `/api`, `/ws`). The frontends are
built with `APP_BASE_PATH` so assets resolve under their subpath.

```bash
cd /root/kanat/queue-system/deploy
cp .env.prod.example .env.prod   # DOMAIN=nmpi.avtoxizmet.uz, real secrets
docker compose -f docker-compose.host.yml --env-file .env.prod up -d --build
sudo cp nginx/nmpi.avtoxizmet.uz.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/nmpi.avtoxizmet.uz.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nmpi.avtoxizmet.uz
```

## Notes
- `.env.prod`, `nginx/queue.conf` (rendered), and `certbot/` are gitignored — they hold
  secrets / host-specific values.
- Backend auth is currently `AllowAny` (parity with the mock phase); enforce per-endpoint
  permissions + WS auth before exposing sensitive data publicly.
- Prod Postgres is **16**; the dev machine used 14 — both fine, schema is identical.
