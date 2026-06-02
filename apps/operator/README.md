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
