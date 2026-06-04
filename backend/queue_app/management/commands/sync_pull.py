"""sync_pull — mirror the cloud catalog into the local box's DB.

Runs on a local box (SYNC_ROLE=local). Cloud is authoritative for the catalog,
so this is a one-way upsert: halls/categories/services/counters/users/settings.
Idempotent — safe to run on every worker tick."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from queue_app import sync, sync_client
from queue_app.models import SyncState


class Command(BaseCommand):
    help = "Pull the catalog snapshot from the cloud and upsert it locally."

    def handle(self, *args, **options):
        snapshot = sync_client.fetch_catalog()
        counts = sync.apply_catalog(snapshot)

        state = SyncState.load()
        state.catalog_pulled_at = timezone.now()
        state.save(update_fields=["catalog_pulled_at", "updated_at"])

        summary = ", ".join(f"{k}={v}" for k, v in counts.items())
        self.stdout.write(self.style.SUCCESS(f"catalog pulled — {summary}"))
