import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded(db):
    call_command("load_services_fixture")


@pytest.fixture
def client():
    return APIClient()


def test_login_returns_contract_shape(seeded, client):
    r = client.post("/api/auth/login", {"username": "admin", "password": "admin"}, format="json")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"token", "username", "role", "expires_at"}
    assert body["role"] == "admin"


def test_login_rejects_bad_credentials(seeded, client):
    r = client.post("/api/auth/login", {"username": "admin", "password": "nope"}, format="json")
    assert r.status_code == 401


def test_categories_and_services(seeded, client):
    cats = client.get("/api/categories").json()
    assert len(cats) == 9
    assert set(cats[0]) == {"id", "hall_id", "code", "name_kaa", "name_ru", "color", "order"}

    svcs = client.get("/api/services?category_id=1").json()
    assert all(s["category_id"] == 1 for s in svcs)
    assert {"id", "category_id", "name_kaa", "name_ru", "sla_days",
            "delivery_type", "requires_visit", "is_active", "is_popular"} == set(svcs[0])


def test_category_create_and_delete(seeded, client):
    before = len(client.get("/api/categories").json())
    r = client.post("/api/categories", {
        "code": "Z", "name_kaa": "Test", "name_ru": "Тест", "color": "#000000", "order": 99,
    }, format="json")
    assert r.status_code == 201
    cid = r.json()["id"]
    assert len(client.get("/api/categories").json()) == before + 1
    d = client.delete(f"/api/categories/{cid}")
    assert d.status_code == 204
    assert len(client.get("/api/categories").json()) == before


def test_service_create_update_delete(seeded, client):
    r = client.post("/api/services", {
        "category_id": 1, "name_kaa": "Jańa xızmet", "name_ru": "Новая услуга",
        "sla_days": 1, "delivery_type": "electron", "requires_visit": True,
        "is_active": True, "is_popular": False,
    }, format="json")
    assert r.status_code == 201
    body = r.json()
    assert body["category_id"] == 1
    sid = body["id"]
    patched = client.patch(f"/api/services/{sid}", {"is_popular": True}, format="json")
    assert patched.json()["is_popular"] is True
    assert client.delete(f"/api/services/{sid}").status_code == 204


def test_counters_serialize_service_ids(seeded, client):
    counters = client.get("/api/counters").json()
    c1 = next(c for c in counters if c["id"] == 1)
    assert isinstance(c1["service_ids"], list) and len(c1["service_ids"]) == 9


def test_kiosk_ticket_create_is_idempotent(seeded, client):
    payload = {"category_id": 1, "service_id": 1, "idempotency_key": "abc"}
    r1 = client.post("/api/tickets", payload, format="json")
    assert r1.status_code == 201
    t1 = r1.json()
    assert t1["number"].startswith("A")
    assert t1["status"] == "waiting"
    r2 = client.post("/api/tickets", payload, format="json")
    assert r2.json()["id"] == t1["id"]


def test_operator_flow_call_finish(seeded, client):
    # queue for counter 1 (serves services incl. 1)
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "k1"}, format="json")

    q = client.get("/api/queue?counter_id=1").json()
    assert len(q) >= 1

    called = client.post("/api/tickets/call-next", {"counter_id": 1, "operator_id": 2}, format="json")
    assert called.status_code == 200
    ticket = called.json()
    assert ticket["status"] == "called"
    assert ticket["counter_id"] == 1

    current = client.get("/api/tickets/current?counter_id=1").json()
    assert current["id"] == ticket["id"]

    fin = client.post(f"/api/tickets/{ticket['id']}/finish")
    assert fin.json()["status"] == "served"

    # current clears
    assert client.get("/api/tickets/current?counter_id=1").json() is None


def test_display_active_after_call(seeded, client):
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "k1"}, format="json")
    client.post("/api/tickets/call-next", {"counter_id": 1, "operator_id": 2}, format="json")
    calls = client.get("/api/display/active").json()
    assert len(calls) == 1
    assert set(calls[0]) == {
        "id", "number", "category_id", "counter_id",
        "counter_number", "counter_name", "called_at", "status",
    }
    assert calls[0]["counter_number"] == "1"


def test_operator_session_lifecycle(seeded, client):
    r = client.post("/api/operator-sessions", {"user_id": 2, "counter_id": 1}, format="json")
    assert r.status_code == 201
    sid = r.json()["id"]
    patched = client.patch(f"/api/operator-sessions/{sid}", {"status": "break"}, format="json")
    assert patched.json()["status"] == "break"


def test_dashboard_shape(seeded, client):
    body = client.get("/api/dashboard").json()
    assert set(body) == {"metrics", "hourly", "recent"}
    assert set(body["metrics"]) == {"ticketsToday", "avgWaitMinutes", "activeCounters", "served"}
    assert body["metrics"]["activeCounters"] == 5


def test_display_settings_get_and_patch(seeded, client):
    r = client.get("/api/display/settings")
    assert r.status_code == 200
    assert "youtube_url" in r.json()

    p = client.patch(
        "/api/display/settings",
        {"youtube_url": "https://youtu.be/abc123"},
        format="json",
    )
    assert p.status_code == 200
    assert p.json()["youtube_url"] == "https://youtu.be/abc123"
    # persisted (singleton)
    assert client.get("/api/display/settings").json()["youtube_url"] == "https://youtu.be/abc123"


def test_display_board_lists_active_windows(seeded, client):
    board = client.get("/api/display/board").json()
    assert len(board) >= 1
    row = board[0]
    assert set(row) == {"counter_id", "counter_number", "counter_name", "current"}
    # all windows idle right after seeding
    assert all(w["current"] is None for w in board)


def test_display_waiting_lists_uncalled_tickets(seeded, client):
    # seeded fixture pre-populates the waiting queue
    waiting = client.get("/api/display/waiting").json()
    assert isinstance(waiting, list)
    if waiting:
        assert set(waiting[0]) == {"id", "number", "category_id"}


def test_halls_endpoint(seeded, client):
    halls = client.get("/api/halls").json()
    assert len(halls) == 2
    assert {h["code"] for h in halls} == {"1", "2"}


def test_categories_filtered_by_hall(seeded, client):
    # All seeded categories belong to hall 1; hall 2 has none yet.
    h1 = client.get("/api/categories?hall_id=1").json()
    h2 = client.get("/api/categories?hall_id=2").json()
    assert len(h1) == 9
    assert len(h2) == 0
    assert all(c["hall_id"] == 1 for c in h1)


def test_display_active_scoped_by_hall(seeded, client):
    # Issue + call a ticket in hall 1, then check hall scoping on the board.
    t = client.post("/api/tickets", {
        "category_id": 1, "service_id": 1, "idempotency_key": "hall-test-1",
    }, format="json").json()
    assert t["hall_id"] == 1
    # counter 1 is in hall 1
    called = client.post("/api/tickets/call-next", {"counter_id": 1}, format="json")
    assert called.status_code == 200
    assert len(client.get("/api/display/active?hall_id=1").json()) >= 1
    assert len(client.get("/api/display/active?hall_id=2").json()) == 0


def test_audit_logs_call_and_lists(seeded, client):
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "au1"}, format="json")
    client.post("/api/tickets/call-next", {"counter_id": 1, "operator_id": 2}, format="json")
    logs = client.get("/api/audit").json()
    assert any(l["action"] == "ticket.called" for l in logs)
    called = next(l for l in logs if l["action"] == "ticket.called")
    assert set(called) == {"id", "actor_id", "actor_label", "action", "target", "meta", "created_at"}
    # filter by action
    only = client.get("/api/audit?action=ticket.called").json()
    assert all(l["action"] == "ticket.called" for l in only)


def test_ticket_recall(seeded, client):
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "rc1"}, format="json")
    called = client.post("/api/tickets/call-next", {"counter_id": 1}, format="json").json()
    r = client.post(f"/api/tickets/{called['id']}/recall")
    assert r.status_code == 200
    logs = client.get("/api/audit?action=ticket.recalled").json()
    assert any(l["target"] == called["number"] for l in logs)


def test_stats_and_export(seeded, client):
    client.post("/api/tickets", {"category_id": 1, "service_id": 1, "idempotency_key": "st1"}, format="json")
    called = client.post("/api/tickets/call-next", {"counter_id": 1}, format="json").json()
    client.post(f"/api/tickets/{called['id']}/finish")
    s = client.get("/api/stats").json()
    assert s["served"] >= 1
    assert {"issued", "served", "skipped", "avg_wait_minutes",
            "avg_service_minutes", "peak_hour", "hourly"} <= set(s)
    r = client.get("/api/stats/export")
    assert r.status_code == 200
    assert "number" in r.content.decode("utf-8")


def test_sync_catalog_snapshot(seeded, client):
    snap = client.get("/api/sync/catalog").json()
    assert {"halls", "categories", "services", "counters", "users", "settings"} <= set(snap)
    assert len(snap["categories"]) == 9
    assert len(snap["halls"]) == 2


def test_sync_events_ingest_idempotent(seeded, client):
    import uuid
    tid = str(uuid.uuid4())
    payload = {"tickets": [{
        "id": tid, "number": "A-999", "hall_id": 1, "category_id": 1,
        "status": "served", "created_at": "2026-06-04T10:00:00Z",
    }]}
    r = client.post("/api/sync/events", payload, format="json")
    assert r.status_code == 200 and r.json()["tickets"] == 1
    # re-push is idempotent (upsert by id)
    r2 = client.post("/api/sync/events", payload, format="json")
    assert r2.json()["tickets"] == 1
    from queue_app.models import Ticket
    assert Ticket.objects.filter(id=tid, number="A-999", status="served").count() == 1
