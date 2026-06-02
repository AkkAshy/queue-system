from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Staff account: admin / operator / viewer.

    Matches the frontend `User` contract: { id, username, name, role,
    counter_id, is_active }. `counter` FK is added in the catalog migration
    once the Counter model exists.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        OPERATOR = "operator", "Operator"
        VIEWER = "viewer", "Viewer"

    name = models.CharField(max_length=150, blank=True)
    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.OPERATOR
    )

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
