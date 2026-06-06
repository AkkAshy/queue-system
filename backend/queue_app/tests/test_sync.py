"""Local-first sync, local-side logic (Phase D).

`apply_catalog` / `collect_events` are pure (no HTTP), so they're tested against
a single DB that plays both roles. The cloud HTTP endpoints are covered in
test_api.py; here we cover the box's mirror + watermark behaviour and the token
guard."""

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from queue_app import sync
from queue_app.models import SyncState, Ticket

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded(db):
    call_command("load_services_fixture")


@pytest.fixture
def client():
    return APIClient()


def test_catalog_snapshot_carries_password_hash(seeded):
    snap = sync.catalog_snapshot()
    admin = next(u for u in snap["users"] if u["username"] == "admin")
    # the hash, not plaintext — Django prefixes with the algorithm id
    assert admin["password"].startswith("pbkdf2_") or "$" in admin["password"]
    assert "hall_id" in admin


def test_apply_catalog_reverts_local_drift_including_password(seeded):
    from accounts.models import User

    admin = User.objects.get(username="admin")
    admin.set_password("cloud-pw")
    admin.save()
    snap = sync.catalog_snapshot()  # cloud-authoritative state

    # local drift: someone changed the password on the box
    admin.set_password("local-drift")
    admin.save()
    assert admin.check_password("local-drift")

    sync.apply_catalog(snap)  # mirror the cloud back down
    admin.refresh_from_db()
    assert admin.check_password("cloud-pw")  # reverted → operator logs in normally


def test_apply_catalog_recreates_missing_rows(seeded):
    from catalog.models import Service

    snap = sync.catalog_snapshot()
    before = Service.objects.count()
    Service.objects.filter(id=Service.objects.first().id).delete()
    assert Service.objects.count() == before - 1

    counts = sync.apply_catalog(snap)
    assert Service.objects.count() == before  # recreated from the snapshot
    assert counts["services"] == before


def test_apply_catalog_syncs_uz_en_names(seeded):
    """Uzbek + English translations must survive snapshot → apply (the offline
    box gets all 4 languages, not just kaa/ru)."""
    from catalog.models import Service

    svc = Service.objects.first()
    svc.name_uz = "Hujjat (uz)"
    svc.name_en = "Document (en)"
    svc.save()

    snap = sync.catalog_snapshot()

    # Simulate the box missing the translations (old apply dropped uz/en).
    Service.objects.filter(id=svc.id).update(name_uz="", name_en="")

    sync.apply_catalog(snap)

    svc.refresh_from_db()
    assert svc.name_uz == "Hujjat (uz)"
    assert svc.name_en == "Document (en)"


def test_apply_catalog_syncs_schedules(seeded):
    from queue_app.models import WorkSchedule

    WorkSchedule.objects.create(
        user_id=1, counter_id=1, weekday=2, start_time="09:00", end_time="13:00",
    )
    snap = sync.catalog_snapshot()
    assert len(snap["schedules"]) == 1

    WorkSchedule.objects.all().delete()
    counts = sync.apply_catalog(snap)
    assert counts["schedules"] == 1
    assert WorkSchedule.objects.filter(weekday=2, counter_id=1).exists()


def test_collect_events_respects_watermark(seeded, client):
    # one ticket created locally
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "s1"}, format="json")
    state = SyncState.load()

    payload, new_wm = sync.collect_events(state)
    assert len(payload["tickets"]) == 1
    sync.advance_watermarks(state, new_wm)

    # nothing new → empty
    payload2, _ = sync.collect_events(state)
    assert payload2["tickets"] == []

    # a second ticket → only that one comes back
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "s2"}, format="json")
    payload3, _ = sync.collect_events(state)
    assert len(payload3["tickets"]) == 1


def test_collect_then_ingest_roundtrip(seeded, client):
    """collect_events output must feed ingest_events unchanged (the real wire path)."""
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "rt"}, format="json")
    payload, _ = sync.collect_events(SyncState.load())
    counts = sync.ingest_events(payload)  # cloud side consumes it
    assert counts["tickets"] == 1
    # the ticket id survives the round-trip
    assert Ticket.objects.filter(id=payload["tickets"][0]["id"]).exists()


def test_sync_endpoints_require_token_when_configured(seeded, client, settings):
    settings.SYNC_TOKEN = "s3cret"
    # no/invalid token → rejected (401 or 403 depending on DRF auth state)
    assert client.get("/api/sync/catalog").status_code in (401, 403)
    assert client.get("/api/sync/catalog", HTTP_X_SYNC_TOKEN="wrong").status_code in (401, 403)
    # correct header → ok
    ok = client.get("/api/sync/catalog", HTTP_X_SYNC_TOKEN="s3cret")
    assert ok.status_code == 200


def test_sync_open_when_token_unset(seeded, client, settings):
    settings.SYNC_TOKEN = ""  # dev default
    assert client.get("/api/sync/catalog").status_code == 200
