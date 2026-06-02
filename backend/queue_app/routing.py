from django.urls import path

from .consumers import RealtimeConsumer

# `group` maps the audience: display board, operator widgets, admin dashboard.
websocket_urlpatterns = [
    path("ws/display", RealtimeConsumer.as_asgi(), kwargs={"group": "display"}),
    path("ws/operator", RealtimeConsumer.as_asgi(), kwargs={"group": "operators"}),
    path("ws/admin", RealtimeConsumer.as_asgi(), kwargs={"group": "admin"}),
]
