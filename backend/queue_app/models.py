from django.db import models


class Counter(models.Model):
    """A service window. Matches the `Counter` contract; `service_ids` is the
    M2M serialized as a flat id list."""

    number = models.CharField(max_length=8)  # display label, e.g. "1", "2A"
    name = models.CharField(max_length=255)
    services = models.ManyToManyField("catalog.Service", related_name="counters", blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["number"]

    def __str__(self) -> str:
        return f"№{self.number} · {self.name}"
