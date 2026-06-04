# NDPI Operator — desktop widget (Tauri v2)

A small **always-on-top** Windows window for the operator's pult. It floats over
HEMIS and other apps so the operator always sees the queue without keeping a
browser tab in front.

It's a **thin client**: the window just loads `http://<box-ip>/operator` from the
local box. The actual UI (the operator Next.js app) lives on the box and updates
centrally — the widget never needs rebuilding when the UI changes.

## How it works
- First launch shows a setup screen → enter the box address (IP or hostname,
  e.g. `192.168.1.50`). It's saved on the machine.
- Next launches auto-connect after a 3s countdown. Press **«Boshqa boks
  (o'zgartirish)»** during the countdown to change the address.
- The window is `alwaysOnTop`, 360×600, movable/closable via its title bar.

The box address is stored in the widget's local storage; the operator's JWT/login
is handled by the operator web app itself (same as in a browser).

## Build (Windows installer)
You do **not** need Rust locally — the GitHub Actions workflow
`.github/workflows/operator-desktop.yml` builds the `.exe`/`.msi` on a Windows
runner. Trigger it from the **Actions** tab (workflow_dispatch) or push a tag
`operator-desktop-v0.1.0`. Download the `ndpi-operator-windows` artifact.

To build locally on a **Windows** machine instead:
```powershell
# prerequisites: Node 20+, pnpm, Rust (rustup), WebView2 (preinstalled on Win10/11)
pnpm install
cd apps/operator-desktop
pnpm tauri build
# installers land in src-tauri/target/release/bundle/{nsis,msi}/
```

Dev preview (on any OS with Rust installed):
```bash
cd apps/operator-desktop
pnpm install
pnpm tauri dev
```

## Deploy on each operator PC
1. Run the `.exe` installer (NSIS) → installs **NDPI Operator**.
2. Launch it, enter the box address once.
3. Optional: add it to **Startup** so it opens with Windows (Win+R →
   `shell:startup` → put a shortcut to the app there).

## Notes
- HTTP on the LAN is fine — the widget does a top-level navigation to
  `http://<box>/operator` (no mixed-content issue, unlike an iframe).
- To change the box address later: relaunch and hit «o'zgartirish» during the
  countdown, or clear the app's data.
- The Rust side is the default Tauri scaffold (no custom commands) — all logic is
  in `src/index.html`. Keeps the build bulletproof.
