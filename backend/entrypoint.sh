#!/usr/bin/env sh
set -e

# Wait for Postgres to accept connections (compose `depends_on` only waits for
# the container to start, not for the DB to be ready).
echo "Waiting for database…"
python - <<'PY'
import os, time, sys
import psycopg
url = os.environ.get("DATABASE_URL", "")
for i in range(60):
    try:
        psycopg.connect(url, connect_timeout=2).close()
        print("Database is up.")
        sys.exit(0)
    except Exception:
        time.sleep(1)
print("Database not reachable after 60s", file=sys.stderr)
sys.exit(1)
PY

python manage.py migrate --noinput

# Optional one-time seed: set SEED_ON_START=1 to load the fixtures.
if [ "${SEED_ON_START:-0}" = "1" ]; then
  python manage.py load_services_fixture || true
fi

exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
