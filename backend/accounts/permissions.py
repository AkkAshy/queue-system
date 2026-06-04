"""Permission classes for role-based access (Phase C).

NOT wired into DEFAULT_PERMISSION_CLASSES yet — enforcement is a deliberate
step that also requires the admin/operator frontends to send the JWT. These are
ready to attach per-view when we flip from AllowAny.
"""

from django.conf import settings
from rest_framework.permissions import SAFE_METHODS, BasePermission


class HasSyncToken(BasePermission):
    """Guards the cloud's /api/sync/* with a shared secret. The local box sends
    it as `X-Sync-Token`. If SYNC_TOKEN is unset (dev/tests), the check is a
    no-op — production MUST set it. Mismatched token → 403."""

    def has_permission(self, request, view):
        expected = getattr(settings, "SYNC_TOKEN", "")
        if not expected:
            return True  # not configured → open (dev only; set it in prod)
        return request.headers.get("X-Sync-Token") == expected


class IsChief(BasePermission):
    """Only the chief administrator (or legacy 'admin'/superuser)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "is_chief", False))


class IsStaff(BasePermission):
    """Any authenticated staff account (operator / hall_admin / chief)."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated)


class IsChiefOrReadOnly(BasePermission):
    """Reads open to anyone (public kiosk/board); writes only for chief."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "is_chief", False))


def hall_scope_ok(user, hall_id) -> bool:
    """A hall_admin may only touch their own hall; chief may touch any."""
    if getattr(user, "is_chief", False):
        return True
    if getattr(user, "is_hall_admin", False):
        return user.hall_id is not None and str(user.hall_id) == str(hall_id)
    return False


class IsCatalogManager(BasePermission):
    """Reads public (kiosk/board); writes for chief OR hall_admin. Per-hall
    scoping is enforced by the view's queryset (hall_admin sees only their hall →
    can't fetch/modify another hall's object → 404)."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(
            u
            and u.is_authenticated
            and (getattr(u, "is_chief", False) or getattr(u, "is_hall_admin", False))
        )


def scope_to_hall(qs, request, field: str = "hall_id"):
    """Limit a queryset to the hall_admin's hall. Chief / anonymous (public
    kiosk reads) see everything."""
    u = getattr(request, "user", None)
    if u and u.is_authenticated and getattr(u, "is_hall_admin", False) and u.hall_id:
        return qs.filter(**{field: u.hall_id})
    return qs
