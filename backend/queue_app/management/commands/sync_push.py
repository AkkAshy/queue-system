"""sync_push — send locally-created events up to the cloud.

Runs on a local box (SYNC_ROLE=local). Collects tickets/sessions/audit changed
since the stored watermark, POSTs them to the cloud (idempotent upsert by PK),
and only advances the watermark once the cloud confirms — so a failed push is
retried next tick with no data loss."""

from django.core.management.base import BaseCommand

from queue_app import sync, sync_client
from queue_app.models import SyncState


class Command(BaseCommand):
    help = "Push locally-created events (tickets/sessions/audit) to the cloud."

    def handle(self, *args, **options):
        state = SyncState.load()
        payload, new_wm = sync.collect_events(state)

        total = sum(len(payload[k]) for k in ("tickets", "sessions", "audit"))
        if total == 0:
            self.stdout.write("nothing to push")
            return

        result = sync_client.send_events(payload)
        # Advance the watermark only after the cloud acknowledged the upsert.
        sync.advance_watermarks(state, new_wm)

        summary = ", ".join(f"{k}={result.get(k, 0)}" for k in ("tickets", "sessions", "audit"))
        self.stdout.write(self.style.SUCCESS(f"events pushed — {summary}"))
