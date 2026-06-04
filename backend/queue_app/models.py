import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Counter(models.Model):
    """A service window. Matches the `Counter` contract; `service_ids` is the
    M2M serialized as a flat id list."""

    # Hall this window belongs to. Nullable for migration; the seed assigns it.
    hall = models.ForeignKey(
        "catalog.Hall", on_delete=models.CASCADE, related_name="counters",
        null=True, blank=True,
    )
    number = models.CharField(max_length=8)  # display label, e.g. "1", "2A"
    name = models.CharField(max_length=255)
    services = models.ManyToManyField("catalog.Service", related_name="counters", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["number"]

    def __str__(self) -> str:
        return f"№{self.number} · {self.name}"


class AuditLog(models.Model):
    """Append-only record of operator/admin actions (calls, transfers, skips,
    catalog changes, logins) with timestamps — TZ §4.5, §7.4. Local-first:
    written locally and synced up to the cloud (synced flag)."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs",
    )
    actor_label = models.CharField(max_length=150, blank=True)  # fallback when no FK
    action = models.CharField(max_length=64)   # e.g. "ticket.called"
    target = models.CharField(max_length=128, blank=True)  # e.g. ticket number
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    synced = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.target}"


class DisplaySettings(models.Model):
    """Singleton config for the display board, editable from the admin app.

    Holds the YouTube URL shown in the board's media zone (and room for more
    board-level settings later, e.g. ticker text).
    """

    youtube_url = models.URLField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Display settings"
        verbose_name_plural = "Display settings"

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton row
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "DisplaySettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return "Display settings"


class TicketStatus(models.TextChoices):
    WAITING = "waiting"
    CALLED = "called"
    SERVING = "serving"
    SERVED = "served"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class Ticket(models.Model):
    """A queue ticket. `id` is a uuid string to match the frontend contract."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    number = models.CharField(max_length=8)  # 'A042'
    hall = models.ForeignKey(
        "catalog.Hall", on_delete=models.PROTECT, related_name="tickets",
        null=True, blank=True,
    )
    category = models.ForeignKey(
        "catalog.ServiceCategory", on_delete=models.PROTECT, related_name="tickets"
    )
    service = models.ForeignKey(
        "catalog.Service", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tickets",
    )
    status = models.CharField(
        max_length=16, choices=TicketStatus.choices, default=TicketStatus.WAITING
    )
    counter = models.ForeignKey(
        Counter, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tickets",
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="served_tickets",
    )
    created_at = models.DateTimeField(default=timezone.now)
    called_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)  # for service-time stats
    updated_at = models.DateTimeField(auto_now=True)  # local→cloud sync watermark
    # Phase-1 idempotency for kiosk double-taps; not part of the API response.
    idempotency_key = models.CharField(max_length=128, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return self.number


class OperatorSession(models.Model):
    """An operator's shift on a counter. Matches the `OperatorSession` contract."""

    class Status(models.TextChoices):
        ACTIVE = "active"
        BREAK = "break"
        ENDED = "ended"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions"
    )
    counter = models.ForeignKey(
        Counter, on_delete=models.CASCADE, related_name="sessions"
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)  # sync watermark

    def __str__(self) -> str:
        return f"session#{self.pk} user={self.user_id} counter={self.counter_id}"


class DailyCounter(models.Model):
    """Per-hall-per-category-code daily sequence for ticket numbers. Reset
    implicitly by keying on the date; concurrency-safe via select_for_update.
    Keyed by hall too so each hall numbers independently (A-001 in hall 1 is
    separate from A-001 in hall 2)."""

    hall = models.ForeignKey(
        "catalog.Hall", on_delete=models.CASCADE, related_name="daily_counters",
        null=True, blank=True,
    )
    code = models.CharField(max_length=4)
    date = models.DateField()
    last_seq = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("hall", "code", "date")

    def __str__(self) -> str:
        return f"{self.code}@{self.date}={self.last_seq}"
