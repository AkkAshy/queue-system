"""Local-first sync (Phase D), cloud side.

Two conflict-free directions:
- Catalog (cloud → local): the cloud is the single writer; local mirrors it.
  `catalog_snapshot()` returns the full catalog for the local box to upsert.
- Events (local → cloud): the local box is the single writer; the cloud ingests.
  `ingest_events()` upserts tickets / sessions / audit by primary key
  (idempotent — re-pushing the same row updates it).

Single office = one local box, so preserving local PKs is safe. Multi-site
would need a (node_id, local_id) composite — noted for later.
"""

from __future__ import annotations

from accounts.models import User
from catalog.models import Hall, Service, ServiceCategory
from catalog.serializers import HallSerializer, ServiceCategorySerializer, ServiceSerializer

from .models import (
    AuditLog,
    Counter,
    DisplaySettings,
    OperatorSession,
    SyncState,
    Ticket,
    WorkSchedule,
)
from .serializers import CounterSerializer, DisplaySettingsSerializer


def _user_snapshot() -> list[dict]:
    """Users for the local box — includes the password HASH and hall_id so
    operators can log in on the box with their real credentials (the hash, never
    plaintext, travels over TLS/Tailscale). Cloud is the single writer."""
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "role": u.role,
            "counter_id": u.counter_id,
            "hall_id": u.hall_id,
            "is_active": u.is_active,
            "is_superuser": u.is_superuser,
            "is_staff": u.is_staff,
            "password": u.password,  # Django PBKDF2 hash, not plaintext
        }
        for u in User.objects.all()
    ]


def catalog_snapshot() -> dict:
    """Everything the local box mirrors from the cloud (cloud is authoritative)."""
    return {
        "halls": HallSerializer(Hall.objects.all(), many=True).data,
        "categories": ServiceCategorySerializer(ServiceCategory.objects.all(), many=True).data,
        "services": ServiceSerializer(Service.objects.all(), many=True).data,
        "counters": CounterSerializer(Counter.objects.all(), many=True).data,
        "users": _user_snapshot(),
        "schedules": _schedule_snapshot(),
        "settings": DisplaySettingsSerializer(DisplaySettings.load()).data,
    }


def _schedule_snapshot() -> list[dict]:
    """Recurring shifts (cloud-authoritative catalog). Raw fields for upsert —
    times as ISO 'HH:MM:SS' strings."""
    return [
        {
            "id": s.id, "user_id": s.user_id, "counter_id": s.counter_id,
            "hall_id": s.hall_id, "weekday": s.weekday,
            "start_time": s.start_time.isoformat(), "end_time": s.end_time.isoformat(),
            "is_active": s.is_active,
        }
        for s in WorkSchedule.objects.all()
    ]


def ingest_events(payload: dict) -> dict:
    """Upsert tickets / sessions / audit pushed up from a local box."""
    counts = {"tickets": 0, "sessions": 0, "audit": 0}

    for t in payload.get("tickets", []):
        Ticket.objects.update_or_create(
            id=t["id"],
            defaults={
                "number": t.get("number", ""),
                "hall_id": t.get("hall_id"),
                "category_id": t.get("category_id"),
                "service_id": t.get("service_id"),
                "status": t.get("status", "waiting"),
                "counter_id": t.get("counter_id"),
                "operator_id": t.get("operator_id"),
                "created_at": t.get("created_at"),
                "called_at": t.get("called_at"),
                "finished_at": t.get("finished_at"),
            },
        )
        counts["tickets"] += 1

    for s in payload.get("sessions", []):
        OperatorSession.objects.update_or_create(
            id=s["id"],
            defaults={
                "user_id": s.get("user_id"),
                "counter_id": s.get("counter_id"),
                "status": s.get("status", "active"),
                "started_at": s.get("started_at"),
                "ended_at": s.get("ended_at"),
            },
        )
        counts["sessions"] += 1

    for a in payload.get("audit", []):
        AuditLog.objects.update_or_create(
            id=a["id"],
            defaults={
                "actor_id": a.get("actor_id"),
                "actor_label": a.get("actor_label", ""),
                "action": a.get("action", ""),
                "target": a.get("target", ""),
                "meta": a.get("meta", {}),
                "created_at": a.get("created_at"),
            },
        )
        counts["audit"] += 1

    return counts


# ===================== local box side =====================
# These run on the on-site box (SYNC_ROLE="local"). `apply_catalog` mirrors a
# cloud snapshot into the local DB; `collect_events` gathers locally-created
# tickets/sessions/audit since the last push. Both are pure (no HTTP) so they're
# unit-testable; the management commands wrap them with requests + watermark IO.


def apply_catalog(snapshot: dict) -> dict:
    """Upsert a cloud catalog snapshot into the local DB (cloud is authoritative).
    FK order matters: halls → categories → services → counters → users → settings."""
    counts = {k: 0 for k in (
        "halls", "categories", "services", "counters", "users", "schedules", "settings",
    )}

    for h in snapshot.get("halls", []):
        Hall.objects.update_or_create(id=h["id"], defaults={
            "code": h["code"], "name_kaa": h["name_kaa"], "name_ru": h["name_ru"],
            "name_uz": h.get("name_uz", ""), "name_en": h.get("name_en", ""),
            "is_active": h["is_active"], "order": h["order"],
        })
        counts["halls"] += 1

    for c in snapshot.get("categories", []):
        ServiceCategory.objects.update_or_create(id=c["id"], defaults={
            "hall_id": c.get("hall_id"), "code": c["code"],
            "name_kaa": c["name_kaa"], "name_ru": c["name_ru"],
            "name_uz": c.get("name_uz", ""), "name_en": c.get("name_en", ""),
            "color": c["color"], "order": c["order"],
        })
        counts["categories"] += 1

    for s in snapshot.get("services", []):
        Service.objects.update_or_create(id=s["id"], defaults={
            "category_id": s["category_id"], "name_kaa": s["name_kaa"],
            "name_ru": s["name_ru"],
            "name_uz": s.get("name_uz", ""), "name_en": s.get("name_en", ""),
            "sla_days": s["sla_days"],
            "delivery_type": s["delivery_type"], "requires_visit": s["requires_visit"],
            "is_active": s["is_active"], "is_popular": s["is_popular"],
        })
        counts["services"] += 1

    for c in snapshot.get("counters", []):
        counter, _ = Counter.objects.update_or_create(id=c["id"], defaults={
            "hall_id": c.get("hall_id"), "number": c["number"],
            "name": c["name"], "is_active": c["is_active"],
        })
        counter.services.set(c.get("service_ids", []))  # M2M
        counts["counters"] += 1

    for u in snapshot.get("users", []):
        User.objects.update_or_create(id=u["id"], defaults={
            "username": u["username"], "name": u.get("name", ""),
            "role": u["role"], "counter_id": u.get("counter_id"),
            "hall_id": u.get("hall_id"), "is_active": u["is_active"],
            "is_superuser": u.get("is_superuser", False),
            "is_staff": u.get("is_staff", False),
            "password": u["password"],  # pre-hashed → set directly, no set_password
        })
        counts["users"] += 1

    for sc in snapshot.get("schedules", []):
        WorkSchedule.objects.update_or_create(id=sc["id"], defaults={
            "user_id": sc["user_id"], "counter_id": sc["counter_id"],
            "hall_id": sc.get("hall_id"), "weekday": sc["weekday"],
            "start_time": sc["start_time"], "end_time": sc["end_time"],
            "is_active": sc["is_active"],
        })
        counts["schedules"] += 1

    settings_data = snapshot.get("settings")
    if settings_data:
        ds = DisplaySettings.load()
        for field, value in settings_data.items():
            setattr(ds, field, value)
        ds.save()
        counts["settings"] = 1

    return counts


def _iso(dt):
    return dt.isoformat() if dt else None


def collect_events(state: SyncState) -> tuple[dict, dict]:
    """Gather local rows changed since the watermark. Returns (payload, new_wm).
    Tickets/sessions advance by `updated_at`; audit by monotonic id."""
    tickets = Ticket.objects.all()
    if state.tickets_wm:
        tickets = tickets.filter(updated_at__gt=state.tickets_wm)
    tickets = list(tickets.order_by("updated_at"))

    sessions = OperatorSession.objects.all()
    if state.sessions_wm:
        sessions = sessions.filter(updated_at__gt=state.sessions_wm)
    sessions = list(sessions.order_by("updated_at"))

    audit = list(
        AuditLog.objects.filter(id__gt=state.audit_wm_id).order_by("id")
    )

    payload = {
        "tickets": [{
            "id": str(t.id), "number": t.number, "hall_id": t.hall_id,
            "category_id": t.category_id, "service_id": t.service_id,
            "status": t.status, "counter_id": t.counter_id,
            "operator_id": t.operator_id, "created_at": _iso(t.created_at),
            "called_at": _iso(t.called_at), "finished_at": _iso(t.finished_at),
        } for t in tickets],
        "sessions": [{
            "id": s.id, "user_id": s.user_id, "counter_id": s.counter_id,
            "status": s.status, "started_at": _iso(s.started_at),
            "ended_at": _iso(s.ended_at),
        } for s in sessions],
        "audit": [{
            "id": a.id, "actor_id": a.actor_id, "actor_label": a.actor_label,
            "action": a.action, "target": a.target, "meta": a.meta,
            "created_at": _iso(a.created_at),
        } for a in audit],
    }

    # New high-water marks — only advance for streams that had rows.
    new_wm = {
        "tickets_wm": tickets[-1].updated_at if tickets else state.tickets_wm,
        "sessions_wm": sessions[-1].updated_at if sessions else state.sessions_wm,
        "audit_wm_id": audit[-1].id if audit else state.audit_wm_id,
    }
    return payload, new_wm


def advance_watermarks(state: SyncState, new_wm: dict) -> None:
    state.tickets_wm = new_wm["tickets_wm"]
    state.sessions_wm = new_wm["sessions_wm"]
    state.audit_wm_id = new_wm["audit_wm_id"]
    state.save()
