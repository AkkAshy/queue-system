from django.db import models


class Hall(models.Model):
    """A service hall (zal). The registrar office has two: 1-zal (student
    services) and 2-zal (references). Each hall has its own independent queue,
    counters, categories, staff and information board."""

    code = models.CharField(max_length=8, unique=True)  # '1', '2'
    name_kaa = models.CharField(max_length=255)
    name_ru = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "code"]

    def __str__(self) -> str:
        return f"{self.code}-zal · {self.name_ru}"


class ServiceCategory(models.Model):
    """A top-level service category (A..I). Matches the `ServiceCategory` contract."""

    # Hall the category belongs to. Nullable for migration; the seed assigns it.
    hall = models.ForeignKey(
        Hall, on_delete=models.CASCADE, related_name="categories",
        null=True, blank=True,
    )
    code = models.CharField(max_length=4)  # 'A', 'B', ... unique within a hall
    name_kaa = models.CharField(max_length=255)
    name_ru = models.CharField(max_length=255)
    color = models.CharField(max_length=9)  # hex
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "code"]
        verbose_name_plural = "service categories"
        # Code is unique per hall (hall 1 and hall 2 may both use 'A').
        constraints = [
            models.UniqueConstraint(
                fields=["hall", "code"], name="uniq_category_code_per_hall"
            )
        ]

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
    is_popular = models.BooleanField(default=False)  # kiosk "popular" shortcut

    class Meta:
        ordering = ["category__order", "id"]

    def __str__(self) -> str:
        return self.name_ru
