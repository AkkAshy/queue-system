# NDPI queue backend — Django 6 + DRF + Channels, served by Daphne (ASGI).
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=2.2.1 \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

# System deps: libpq for psycopg, curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install "poetry==${POETRY_VERSION}"

# Install only main deps (no dev) — leverage layer caching on lockfile.
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root

COPY . .

# Collectstatic at build (manifest storage); migrations run at start.
RUN SECRET_KEY=build DATABASE_URL=sqlite:////tmp/build.sqlite3 \
    python manage.py collectstatic --noinput

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
