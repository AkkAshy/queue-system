"""Realtime WS tests. In-memory channel layer (see conftest); pytest-asyncio
gives each test a clean event loop. Routed through URLRouter directly to skip
auth/DB."""

import pytest
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from queue_app import realtime
from queue_app.routing import websocket_urlpatterns


def _app():
    return URLRouter(websocket_urlpatterns)


@pytest.mark.asyncio
async def test_display_consumer_connects_and_receives_broadcast():
    comm = WebsocketCommunicator(_app(), "/ws/display")
    connected, _ = await comm.connect()
    assert connected
    await get_channel_layer().group_send(
        "display", {"type": "broadcast", "event": "ticket.called"}
    )
    msg = await comm.receive_json_from()
    await comm.disconnect()
    assert msg == {"event": "ticket.called"}


@pytest.mark.asyncio
async def test_groups_are_isolated():
    """A message to one audience must not leak to another."""
    display = WebsocketCommunicator(_app(), "/ws/display")
    operator = WebsocketCommunicator(_app(), "/ws/operator")
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
