from django.contrib import admin

from .models import Counter, DisplaySettings


@admin.register(Counter)
class CounterAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "is_active")
    filter_horizontal = ("services",)


@admin.register(DisplaySettings)
class DisplaySettingsAdmin(admin.ModelAdmin):
    list_display = ("__str__", "youtube_url", "updated_at")
