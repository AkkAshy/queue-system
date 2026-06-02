"""Broadcast helper — fan a lightweight trigger to the WS groups.

Called from the mutation views (not services.py) so the domain layer stays
synchronous and side-effect-free for unit tests.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

# Audiences (match queue_app/routing.py group names).
DISPLAY = "display"
OPERATORS = "operators"
ADMIN = "admin"


def broadcast(groups, event: str) -> None:
    """Send `{event}` to each group. No-op if no channel layer is configured."""
    layer = get_channel_layer()
    if layer is None:
        return
    for group in groups:
        async_to_sync(layer.group_send)(
            group, {"type": "broadcast", "event": event}
        )
