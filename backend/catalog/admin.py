from django.contrib import admin

from .models import Service, ServiceCategory


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name_ru", "order")
    ordering = ("order",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ru", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name_ru", "name_kaa")
