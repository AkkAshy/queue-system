"""Permission classes for role-based access (Phase C).

NOT wired into DEFAULT_PERMISSION_CLASSES yet — enforcement is a deliberate
step that also requires the admin/operator frontends to send the JWT. These are
ready to attach per-view when we flip from AllowAny.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


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
