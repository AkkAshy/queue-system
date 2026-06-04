"""Realtime WS tests. In-memory channel layer (see conftest); pytest-asyncio
gives each test a clean event loop.

Display is a public board → routed straight through URLRouter (no auth). The
operator/admin groups carry staff data, so they go through JWTAuthMiddleware and
require a valid `token` query param — mirroring production (config/asgi.py)."""

import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from queue_app import realtime
from queue_app.routing import websocket_urlpatterns
from queue_app.ws_auth import JWTAuthMiddleware


def _public_app():
    return URLRouter(websocket_urlpatterns)


def _auth_app():
    return JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


@database_sync_to_async
def _make_operator_token():
    from rest_framework_simplejwt.tokens import AccessToken

    from accounts.models import User

    user = User.objects.create_user(username="op_ws", password="x", role="operator")
    return str(AccessToken.for_user(user))


@pytest.mark.asyncio
async def test_display_consumer_connects_and_receives_broadcast():
    comm = WebsocketCommunicator(_public_app(), "/ws/display")
    connected, _ = await comm.connect()
    assert connected
    await get_channel_layer().group_send(
        "display", {"type": "broadcast", "event": "ticket.called"}
    )
    msg = await comm.receive_json_from()
    await comm.disconnect()
    assert msg == {"event": "ticket.called"}


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_operator_requires_token():
    """No token → the protected group rejects the handshake (4401)."""
    comm = WebsocketCommunicator(_auth_app(), "/ws/operator")
    connected, code = await comm.connect()
    assert not connected
    assert code == 4401


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_operator_connects_with_valid_token():
    token = await _make_operator_token()
    comm = WebsocketCommunicator(_auth_app(), f"/ws/operator?token={token}")
    connected, _ = await comm.connect()
    assert connected
    await get_channel_layer().group_send(
        realtime.OPERATORS, {"type": "broadcast", "event": "ticket.created"}
    )
    msg = await comm.receive_json_from()
    await comm.disconnect()
    assert msg == {"event": "ticket.created"}


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_groups_are_isolated():
    """A message to one audience must not leak to another."""
    token = await _make_operator_token()
    display = WebsocketCommunicator(_public_app(), "/ws/display")
    operator = WebsocketCommunicator(_auth_app(), f"/ws/operator?token={token}")
    await display.connect()
    await operator.connect()

    await get_channel_layer().group_send(
        realtime.OPERATORS, {"type": "broadcast", "event": "ticket.created"}
    )

    msg = await operator.receive_json_from()
    display_silent = await display.receive_nothing(timeout=0.3)

    await display.disconnect()
    await operator.disconnect()

    assert msg == {"event": "ticket.created"}
    assert display_silent  # display group received nothing
