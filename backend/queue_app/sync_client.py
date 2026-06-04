"""HTTP client for the local box → cloud sync (Phase D, local side).

Thin wrapper over `requests` so the management commands stay declarative and the
pure logic in `sync.py` stays HTTP-free (and unit-testable). Raises on transport
or HTTP errors so the worker's backoff can catch them."""

from __future__ import annotations

import requests
from django.conf import settings


class SyncConfigError(RuntimeError):
    """Raised when a local-side command runs without CLOUD_URL configured."""


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if settings.SYNC_TOKEN:
        h["X-Sync-Token"] = settings.SYNC_TOKEN
    return h


def _require_cloud() -> str:
    url = settings.CLOUD_URL
    if not url:
        raise SyncConfigError(
            "CLOUD_URL is not set — this command only runs on a local box "
            "(SYNC_ROLE=local)."
        )
    return url


def fetch_catalog(timeout: int = 30) -> dict:
    """GET the cloud catalog snapshot."""
    url = f"{_require_cloud()}/api/sync/catalog"
    resp = requests.get(url, headers=_headers(), timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def send_events(payload: dict, timeout: int = 30) -> dict:
    """POST locally-collected events to the cloud ingest endpoint."""
    url = f"{_require_cloud()}/api/sync/events"
    resp = requests.post(url, json=payload, headers=_headers(), timeout=timeout)
    resp.raise_for_status()
    return resp.json()
