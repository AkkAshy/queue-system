"""ASGI config — HTTP (Django) + WebSocket (Channels)."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialise Django before importing anything that touches the app registry.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from queue_app.routing import websocket_urlpatterns  # noqa: E402
from queue_app.ws_auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # JWT from the `token` query param → scope["user"]; the consumer enforces
        # which groups require it (operator/admin) vs. stay public (display).
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
