"""Audit logging helper + a DRF mixin for catalog CRUD.

Records who did what and when. The actor is taken from the authenticated user
when present; once Phase C enforcement lands, actors populate automatically.
Until then we still capture an explicit label (e.g. operator id) where the
request carries one.
"""

from __future__ import annotations

from .models import AuditLog


def _actor_of(request):
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def log(request, action: str, *, target: str = "", actor_label: str = "", **meta):
    """Write one audit record. Never raises — auditing must not break the action."""
    try:
        actor = _actor_of(request)
        AuditLog.objects.create(
            actor=actor,
            actor_label=actor_label or (actor.username if actor else ""),
            action=action,
            target=str(target),
            meta=meta or {},
        )
    except Exception:  # pragma: no cover - audit is best-effort
        pass


class AuditCRUDMixin:
    """Mixin for DRF generic views: audits create/update/delete.

    Set `audit_entity` (e.g. "category") on the view.
    """

    audit_entity = "object"

    def perform_create(self, serializer):
        obj = serializer.save()
        log(self.request, f"{self.audit_entity}.created", target=getattr(obj, "id", ""))

    def perform_update(self, serializer):
        obj = serializer.save()
        log(self.request, f"{self.audit_entity}.updated", target=getattr(obj, "id", ""))

    def perform_destroy(self, instance):
        ident = getattr(instance, "id", "")
        instance.delete()
        log(self.request, f"{self.audit_entity}.deleted", target=ident)
