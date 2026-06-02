from django.db import models


class ServiceCategory(models.Model):
    """A top-level service category (A..I). Matches the `ServiceCategory` contract."""

    code = models.CharField(max_length=4, unique=True)  # 'A', 'B', ...
    name_kaa = models.CharField(max_length=255)
    name_ru = models.CharField(max_length=255)
    color = models.CharField(max_length=9)  # hex
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "code"]
        verbose_name_plural = "service categories"

    def __str__(self) -> str:
        return f"{self.code} · {self.name_ru}"


class Service(models.Model):
    """A concrete service under a category. Matches the `Service` contract."""

    class DeliveryType(models.TextChoices):
        ELECTRON = "electron"
        QAGAZ = "qagaz"
        AWIZEKI = "awizeki"
        ELECTRON_QAGAZ = "electron_qagaz"
        ELECTRON_AWIZEKI = "electron_awizeki"
        JIYNALMALI_PAPKA = "jiynalmali_papka"

    category = models.ForeignKey(
        ServiceCategory, on_delete=models.CASCADE, related_name="services"
    )
    name_kaa = models.CharField(max_length=512)
    name_ru = models.CharField(max_length=512)
    sla_days = models.PositiveIntegerField(default=0)  # 0 = immediate
    delivery_type = models.CharField(
        max_length=32, choices=DeliveryType.choices
    )
    requires_visit = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category__order", "id"]

    def __str__(self) -> str:
        return self.name_ru
