#!/usr/bin/env bash
# Launch the operator widget in a pinned Chrome app-mode window.
# Usage: ./launch.sh [URL]
#   URL defaults to http://localhost:3003
# Positions itself top-right by default; drag to wherever fits.

set -euo pipefail

URL="${1:-http://localhost:3003}"
WIDTH=360
HEIGHT=560

# macOS
if [[ "$(uname -s)" == "Darwin" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [[ ! -x "$CHROME" ]]; then
    echo "Google Chrome not found at $CHROME" >&2
    exit 1
  fi
  exec "$CHROME" \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run \
    --no-default-browser-check
fi

# Linux (Ubuntu)
if command -v google-chrome >/dev/null 2>&1; then
  exec google-chrome \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run \
    --no-default-browser-check
fi

if command -v chromium >/dev/null 2>&1; then
  exec chromium \
    --app="$URL" \
    --window-size="$WIDTH,$HEIGHT" \
    --user-data-dir="$HOME/.config/ndpi-operator-widget" \
    --no-first-run
fi

echo "No supported Chromium-based browser found (tried google-chrome, chromium)." >&2
exit 1
