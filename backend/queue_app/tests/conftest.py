import pytest
from channels.layers import channel_layers


@pytest.fixture(autouse=True)
def in_memory_channel_layer(settings):
    """Use an in-memory channel layer for tests (no Redis dependency) and reset
    the cached backend between tests so each async scenario gets a fresh layer
    bound to its own event loop."""
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}
    }
    channel_layers.backends = {}
    yield
    channel_layers.backends = {}
