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
from accounts.serializers import UserSerializer
from catalog.models import Hall, Service, ServiceCategory
from catalog.serializers import HallSerializer, ServiceCategorySerializer, ServiceSerializer

from .models import AuditLog, Counter, DisplaySettings, OperatorSession, Ticket
from .serializers import CounterSerializer, DisplaySettingsSerializer


def catalog_snapshot() -> dict:
    """Everything the local box mirrors from the cloud (cloud is authoritative)."""
    return {
        "halls": HallSerializer(Hall.objects.all(), many=True).data,
        "categories": ServiceCategorySerializer(ServiceCategory.objects.all(), many=True).data,
        "services": ServiceSerializer(Service.objects.all(), many=True).data,
        "counters": CounterSerializer(Counter.objects.all(), many=True).data,
        "users": UserSerializer(User.objects.all(), many=True).data,
        "settings": DisplaySettingsSerializer(DisplaySettings.load()).data,
    }


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
