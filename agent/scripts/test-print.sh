#!/usr/bin/env bash
# Sends a test print job to a running agent. Useful for verifying the printer
# is wired correctly. Requires `curl` and a running agent on :8089.
#
# Usage: ./test-print.sh [AGENT_URL]
#   AGENT_URL defaults to http://127.0.0.1:8089

set -euo pipefail

URL="${1:-http://127.0.0.1:8089}"

payload=$(cat <<'JSON'
{
  "number": "TEST01",
  "category_code": "A",
  "category_name_kaa": "Akademiyalıq iskerlik",
  "category_name_ru": "Академическая деятельность",
  "service_name_kaa": "Akademiyalıq maǵlıwmatnama hám transkript alıw",
  "service_name_ru": "Получение академической справки и транскрипта",
  "issued_at": "2026-04-20T14:30:00Z",
  "ticket_id": "smoke-test-0001"
}
JSON
)

echo "health check → $URL/health"
curl -fsS "$URL/health" && echo
echo
echo "sending test print to $URL/print…"
curl -fsS -X POST "$URL/print" \
  -H "content-type: application/json" \
  -d "$payload" && echo
