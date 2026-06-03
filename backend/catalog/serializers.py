from rest_framework import serializers

from .models import Service, ServiceCategory


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "code", "name_kaa", "name_ru", "color", "order"]


class ServiceSerializer(serializers.ModelSerializer):
    # writable: required on create, optional on PATCH
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=ServiceCategory.objects.all()
    )

    class Meta:
        model = Service
        fields = [
            "id", "category_id", "name_kaa", "name_ru", "sla_days",
            "delivery_type", "requires_visit", "is_active", "is_popular",
        ]
