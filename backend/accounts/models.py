from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Staff account: admin / operator / viewer.

    Matches the frontend `User` contract: { id, username, name, role,
    counter_id, is_active }. `counter` FK is added in the catalog migration
    once the Counter model exists.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"            # legacy = chief (full access)
        CHIEF_ADMIN = "chief_admin", "Chief administrator"
        HALL_ADMIN = "hall_admin", "Hall administrator"
        OPERATOR = "operator", "Operator"
        VIEWER = "viewer", "Viewer"

    name = models.CharField(max_length=150, blank=True)
    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.OPERATOR
    )
    # Hall this account is scoped to (hall_admin/operator). Null for chief/admin.
    hall = models.ForeignKey(
        "catalog.Hall",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff",
    )
    counter = models.ForeignKey(
        "queue_app.Counter",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="operators",
    )

    @property
    def is_chief(self) -> bool:
        """Full-system access (legacy 'admin' is treated as chief)."""
        return self.role in (self.Role.CHIEF_ADMIN, self.Role.ADMIN) or self.is_superuser

    @property
    def is_hall_admin(self) -> bool:
        return self.role == self.Role.HALL_ADMIN

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
