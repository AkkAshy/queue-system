from django.contrib import admin

from .models import Counter


@admin.register(Counter)
class CounterAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "is_active")
    filter_horizontal = ("services",)
