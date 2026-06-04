from django.contrib import admin

from .models import Hall, Service, ServiceCategory


@admin.register(Hall)
class HallAdmin(admin.ModelAdmin):
    list_display = ("code", "name_ru", "is_active", "order")
    ordering = ("order",)


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name_ru", "hall", "order")
    list_filter = ("hall",)
    ordering = ("order",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name_ru", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name_ru", "name_kaa")
