"""sync_worker — the local box's sync loop.

Pulls the catalog then pushes events every SYNC_INTERVAL seconds. On any failure
(typically the cloud being unreachable — the box is offline) it backs off
exponentially up to SYNC_BACKOFF_MAX, then resets to the normal cadence once a
tick succeeds. Run as its own process/container on the box; stop with SIGINT.

This is the lightweight alternative to Celery beat — no broker, fits a single
on-site box."""

import signal
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from queue_app import sync, sync_client
from queue_app.models import SyncState


class Command(BaseCommand):
    help = "Run the continuous local→cloud / cloud→local sync loop (local box)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--once", action="store_true",
            help="Run a single pull+push tick and exit (for cron/testing).",
        )

    def handle(self, *args, **options):
        if settings.SYNC_ROLE != "local":
            raise CommandError(
                f"SYNC_ROLE is '{settings.SYNC_ROLE}', not 'local' — the worker "
                "only runs on an on-site box."
            )
        if not settings.CLOUD_URL:
            raise CommandError("CLOUD_URL is not set.")

        if options["once"]:
            self._tick()
            return

        self._running = True
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)

        interval = settings.SYNC_INTERVAL
        backoff = interval
        self.stdout.write(self.style.SUCCESS(f"sync_worker started → {settings.CLOUD_URL}"))
        while self._running:
            try:
                self._tick()
                backoff = interval  # recovered → normal cadence
                self._sleep(interval)
            except Exception as exc:  # offline / cloud error → back off
                self.stderr.write(self.style.WARNING(f"sync failed: {exc} (retry in {backoff}s)"))
                self._sleep(backoff)
                backoff = min(backoff * 2, settings.SYNC_BACKOFF_MAX)
        self.stdout.write("sync_worker stopped")

    def _tick(self):
        """One full sync cycle: catalog down, events up."""
        snapshot = sync_client.fetch_catalog()
        cat = sync.apply_catalog(snapshot)

        state = SyncState.load()
        state.catalog_pulled_at = timezone.now()
        state.save(update_fields=["catalog_pulled_at", "updated_at"])

        payload, new_wm = sync.collect_events(state)
        pushed = sum(len(payload[k]) for k in ("tickets", "sessions", "audit"))
        if pushed:
            sync_client.send_events(payload)
            sync.advance_watermarks(state, new_wm)
        self.stdout.write(
            f"tick ok — pulled {sum(cat.values())} catalog rows, pushed {pushed} events"
        )

    def _sleep(self, seconds):
        # Sleep in 1s slices so SIGINT/SIGTERM is honoured promptly.
        for _ in range(int(seconds)):
            if not self._running:
                return
            time.sleep(1)

    def _stop(self, *_):
        self._running = False
