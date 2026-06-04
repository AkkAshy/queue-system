from django.contrib import admin

from .models import AuditLog, Counter, DisplaySettings


@admin.register(Counter)
class CounterAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "is_active")
    filter_horizontal = ("services",)


@admin.register(DisplaySettings)
class DisplaySettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "youtube_url", "updated_at")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "action", "target", "actor", "actor_label")
    list_filter = ("action",)
    search_fields = ("target", "actor_label")
    readonly_fields = ("created_at",)
