import pytest
from channels.layers import channel_layers
from django.core.management import call_command
from rest_framework.test import APIClient


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


@pytest.fixture
def seeded(db):
    call_command("load_services_fixture")


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def auth_client(seeded):
    """APIClient, залогиненный как chief-админ (admin/admin из фикстуры)."""
    c = APIClient()
    tok = c.post(
        "/api/auth/login", {"username": "admin", "password": "admin"}, format="json"
    ).json()["token"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c
