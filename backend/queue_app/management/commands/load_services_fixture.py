"""Seed the DB from the shared MSW JSON fixtures (single source of truth).

Idempotent: re-running updates rows in place. Preserves fixture `id` values so
cross-references (category_id, service_id, counter_id) stay consistent with the
frontend's expectations.

    poetry run python manage.py load_services_fixture
"""

import json
import os
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Service, ServiceCategory
from queue_app.models import Counter

# Dev reads the monorepo single source; prod (Docker) vendors a copy and sets
# FIXTURES_DIR (the JS packages aren't shipped in the backend image).
_DEFAULT_FIXTURES = (
    Path(__file__).resolve().parents[4] / "packages" / "mocks" / "src" / "fixtures"
)
FIXTURES = Path(os.environ.get("FIXTURES_DIR", _DEFAULT_FIXTURES))

DEFAULT_PASSWORDS = {"admin": "admin"}
FALLBACK_PASSWORD = "operator"


class Command(BaseCommand):
    help = "Load categories/services/counters/users from the shared MSW fixtures."

    def _load(self, name):
        with open(FIXTURES / name, encoding="utf-8") as fh:
            return json.load(fh)

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()

        cats = self._load("categories.json")
        for c in cats:
            ServiceCategory.objects.update_or_create(
                id=c["id"],
                defaults={
                    "code": c["code"],
                    "name_kaa": c["name_kaa"],
                    "name_ru": c["name_ru"],
                    "color": c["color"],
                    "order": c["order"],
                },
            )

        services = self._load("services.json")
        for s in services:
            Service.objects.update_or_create(
                id=s["id"],
                defaults={
                    "category_id": s["category_id"],
                    "name_kaa": s["name_kaa"],
                    "name_ru": s["name_ru"],
                    "sla_days": s["sla_days"],
                    "delivery_type": s["delivery_type"],
                    "requires_visit": s["requires_visit"],
                    "is_active": s["is_active"],
                    "is_popular": s.get("is_popular", False),
                },
            )

        counters = self._load("counters.json")
        for c in counters:
            counter, _ = Counter.objects.update_or_create(
                id=c["id"],
                defaults={
                    "number": c["number"],
                    "name": c["name"],
                    "is_active": c["is_active"],
                },
            )
            counter.services.set(c["service_ids"])

        users = self._load("users.json")
        for u in users:
            user, created = User.objects.update_or_create(
                id=u["id"],
                defaults={
                    "username": u["username"],
                    "name": u["name"],
                    "role": u["role"],
                    "counter_id": u["counter_id"],
                    "is_active": u["is_active"],
                    "is_staff": u["role"] == "admin",
                    "is_superuser": u["role"] == "admin",
                },
            )
            # (Re)set a known password so the seed is reproducible.
            user.set_password(DEFAULT_PASSWORDS.get(u["username"], FALLBACK_PASSWORD))
            user.save(update_fields=["password"])

        # We inserted rows with explicit PKs, which leaves Postgres' auto-increment
        # sequences behind — the next plain INSERT (e.g. admin "Create") would
        # collide on the PK. Reset every affected sequence to MAX(id)+1.
        self._reset_sequences([ServiceCategory, Service, Counter, User])

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded: {len(cats)} categories, {len(services)} services, "
                f"{len(counters)} counters, {len(users)} users."
            )
        )

    def _reset_sequences(self, models):
        """Advance Postgres auto-increment sequences past the explicitly-seeded
        PKs so the next plain INSERT doesn't collide."""
        from django.core.management.color import no_style
        from django.db import connection

        statements = connection.ops.sequence_reset_sql(no_style(), models)
        if statements:
            with connection.cursor() as cursor:
                for sql in statements:
                    cursor.execute(sql)
