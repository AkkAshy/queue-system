# NDPI Queue Agent

Local printer agent for the NDPI electronic-queue system.
Listens on `localhost:8089`; the kiosk frontend calls `POST /print` whenever
a student confirms a service, and the agent delivers ESC/POS bytes to an
**Xprinter XP-80T** thermal receipt printer.

## Layout

- `main.go` — bootstrap, flags, graceful shutdown
- `config/`  — env + flags → `Config`
- `printer/` — ESC/POS command builder, encoding (CP1251 + KAA transliteration), ticket template, writer backends
- `server/`  — HTTP handlers (`POST /print`, `GET /health`)
- `scripts/test-print.sh` — manual smoke test
- `systemd/ndpi-queue-agent.service` — Linux service unit

## Build

```bash
cd agent
go build -o dist/agent .
```

## Run (quick-start)

### macOS — with Xprinter XP-80T connected via USB

1. Install the manufacturer driver once (downloads from `xprintertech.com` or
   similar). The printer then appears as a CUPS queue; find its name:

   ```bash
   lpstat -p
   # printer XP-80T is idle.  enabled since …
   ```

2. Start the agent using that queue name:

   ```bash
   AGENT_BACKEND=cups AGENT_PRINTER_NAME=XP-80T ./dist/agent
   ```

3. Verify:

   ```bash
   ./scripts/test-print.sh
   ```

   A test ticket should print with header, a large `TEST01` number, bilingual
   category/service, timestamp, and a QR code.

### Linux (Ubuntu 24.04)

Option A — via CUPS (recommended; same flow as macOS after setup):

```bash
sudo apt install cups cups-client
# add printer via web UI at http://localhost:631 or
sudo lpadmin -p XP-80T -E -v usb://... -m raw
AGENT_BACKEND=cups AGENT_PRINTER_NAME=XP-80T ./dist/agent
```

Option B — raw device (no CUPS):

```bash
ls /dev/usb/lp*           # confirm lp0 exists
sudo usermod -aG lp $USER # allow current user to write to it; log out/in
AGENT_BACKEND=file AGENT_PRINTER_DEVICE=/dev/usb/lp0 ./dist/agent
```

### Dev mode (no real printer)

```bash
AGENT_BACKEND=null ./dist/agent
# Prints to stdout-style logs only; great for smoke-testing from the kiosk.
```

## Configuration

| Env var                         | Flag                    | Default             | Notes |
|---------------------------------|-------------------------|---------------------|-------|
| `AGENT_ADDR`                    | `-addr`                 | `127.0.0.1:8089`    | HTTP listen address |
| `AGENT_BACKEND`                 | `-backend`              | `cups`              | `cups` / `file` / `null` |
| `AGENT_PRINTER_NAME`            | `-printer-name`         | `XP-80T`            | CUPS queue name |
| `AGENT_PRINTER_DEVICE`          | `-printer-device`       | *(empty)*           | e.g. `/dev/usb/lp0` when backend=file |
| `AGENT_PRINT_TIMEOUT_SECONDS`   | `-print-timeout-seconds`| `10`                | Per-job write timeout |
| `AGENT_LOG_FILE`                | `-log-file`             | *(stdout only)*     | Appends to this file + stdout |

## API

### `GET /health`

```
{ "ok": true, "writer": "cups:XP-80T" }
```

### `POST /print`

Request:

```json
{
  "number": "A042",
  "category_code": "A",
  "category_name_kaa": "Akademiyalıq iskerlik",
  "category_name_ru": "Академическая деятельность",
  "service_name_kaa": "Akademiyalıq maǵlıwmatnama hám transkript alıw",
  "service_name_ru": "Получение академической справки и транскрипта",
  "issued_at": "2026-04-20T14:30:00Z",
  "ticket_id": "b4a8d8f3-1234-4bcd-9abc-123456789abc"
}
```

Response `200 OK`:

```json
{ "ok": true, "number": "A042" }
```

Errors return `4xx` / `5xx` with `{"ok": false, "error": "…"}`.

## Known limitations (v1)

- **Karakalpak diacritics** (`ǵ`, `ń`, `á`, `ó`, `ú`) are printed with an
  ASCII digraph fallback (`g'`, `n'`, `a'`, `o'`, `u'`). This is because
  thermal printers only have one code page active at a time and we picked
  CP1251 for Russian. A v2 upgrade can render KAA text as a raster bitmap
  and combine both scripts on the same ticket.
- **No retry.** A failed `Write` returns `502`. The kiosk retries via the
  same idempotency-key path.

## Windows kiosk (backend=windows)

The kiosk in the office runs on Windows, so the agent has a `windows` backend
that sends raw ESC/POS bytes through the Windows print spooler (RAW datatype) —
no driver rendering, no CUPS.

```
GOOS=windows GOARCH=amd64 go build -o ndpi-agent.exe .
```

Run it on the kiosk PC (set the printer's *installed Windows name*):

```bat
set AGENT_BACKEND=windows
set AGENT_PRINTER_NAME=XP-80T
set AGENT_ADDR=127.0.0.1:8089
ndpi-agent.exe
```

Autostart: drop a shortcut (or the above as a `.bat`) into
`shell:startup`, or register it as a service with `nssm`.

**No mixed-content problem:** the kiosk page is served over HTTPS
(`https://nmpi.avtoxizmet.uz`) but calls the agent at `http://localhost:8089`.
Browsers treat `localhost`/`127.0.0.1` as a *secure context*, so the HTTPS page
is allowed to reach the local HTTP agent — as long as the agent runs on the
**same machine** as the kiosk browser.

## Kiosk-host mode (single binary: UI + API + print + Chrome)

Set `AGENT_UPSTREAM` and the agent becomes the *only* thing the kiosk PC needs:
it serves the kiosk UI + `/api` + `/ws` by reverse-proxying the cloud, handles
`/print` locally, and (with `--kiosk` / `AGENT_KIOSK=1`) launches Chrome in
kiosk mode at its own `http://localhost` — the whole page is one same-origin
HTTP host (no mixed content at all).

```bat
set AGENT_BACKEND=windows
set AGENT_PRINTER_NAME=XP-80T
set AGENT_ADDR=127.0.0.1:8089
set AGENT_UPSTREAM=https://nmpi.avtoxizmet.uz
set AGENT_KIOSK=1
ndpi-agent.exe
```

Entire kiosk install = `ndpi-agent.exe` + this `.bat` in `shell:startup`.
Chrome must already be installed (Go can't embed a browser). The UI still loads
from the cloud (needs internet); an offline-cached UI is a future `embed` build.

## Deploying on the kiosk PC (Ubuntu)

```bash
sudo cp dist/agent /usr/local/bin/ndpi-queue-agent
sudo useradd --system --no-create-home --shell /usr/sbin/nologin ndpi-agent
sudo usermod -aG lp ndpi-agent
sudo touch /var/log/ndpi-queue-agent.log
sudo chown ndpi-agent:ndpi-agent /var/log/ndpi-queue-agent.log
sudo cp systemd/ndpi-queue-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ndpi-queue-agent
sudo systemctl status ndpi-queue-agent
```
