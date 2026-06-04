from rest_framework import serializers

from .models import Hall, Service, ServiceCategory


class HallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hall
        fields = [
            "id", "code", "name_kaa", "name_ru", "name_uz", "name_en",
            "is_active", "order",
        ]


class ServiceCategorySerializer(serializers.ModelSerializer):
    hall_id = serializers.PrimaryKeyRelatedField(
        source="hall", queryset=Hall.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = ServiceCategory
        fields = [
            "id", "hall_id", "code", "name_kaa", "name_ru", "name_uz", "name_en",
            "color", "order",
        ]
        # Drop DRF's auto unique-together validator (it would require `hall` in
        # every payload). The DB UniqueConstraint(hall, code) still guards integrity.
        validators = []


class ServiceSerializer(serializers.ModelSerializer):
    # writable: required on create, optional on PATCH
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=ServiceCategory.objects.all()
    )

    class Meta:
        model = Service
        fields = [
            "id", "category_id", "name_kaa", "name_ru", "name_uz", "name_en",
            "sla_days", "delivery_type", "requires_visit", "is_active", "is_popular",
        ]
