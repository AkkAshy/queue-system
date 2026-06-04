from django.contrib.auth import get_user_model
from rest_framework import serializers

from catalog.models import Hall, Service

User = get_user_model()

from .models import (
    AuditLog,
    Counter,
    DisplaySettings,
    OperatorSession,
    Ticket,
    WorkSchedule,
)


class CounterSerializer(serializers.ModelSerializer):
    service_ids = serializers.PrimaryKeyRelatedField(
        source="services", many=True, queryset=Service.objects.all(), required=False
    )
    hall_id = serializers.PrimaryKeyRelatedField(
        source="hall", queryset=Hall.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Counter
        fields = ["id", "hall_id", "number", "name", "service_ids", "is_active"]


class TicketSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(source="category", read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        source="service", read_only=True, allow_null=True
    )
    counter_id = serializers.PrimaryKeyRelatedField(
        source="counter", read_only=True, allow_null=True
    )
    operator_id = serializers.PrimaryKeyRelatedField(
        source="operator", read_only=True, allow_null=True
    )
    hall_id = serializers.PrimaryKeyRelatedField(
        source="hall", read_only=True, allow_null=True
    )

    class Meta:
        model = Ticket
        fields = [
            "id", "number", "hall_id", "category_id", "service_id", "status",
            "counter_id", "operator_id", "created_at", "called_at",
        ]


class CreateTicketSerializer(serializers.Serializer):
    category_id = serializers.IntegerField()
    service_id = serializers.IntegerField(required=False, allow_null=True)
    idempotency_key = serializers.CharField()


class OperatorSessionSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(source="user", read_only=True)
    counter_id = serializers.PrimaryKeyRelatedField(source="counter", read_only=True)

    class Meta:
        model = OperatorSession
        fields = ["id", "user_id", "counter_id", "status", "started_at", "ended_at"]


class DisplayCallSerializer(serializers.Serializer):
    """Serializes a Ticket (with .counter) into the DisplayCall shape."""

    id = serializers.UUIDField()
    number = serializers.CharField()
    category_id = serializers.IntegerField()
    counter_id = serializers.IntegerField()
    counter_number = serializers.CharField(source="counter.number")
    counter_name = serializers.CharField(source="counter.name")
    called_at = serializers.DateTimeField()
    status = serializers.CharField()


class DisplayWaitingSerializer(serializers.Serializer):
    """A waiting ticket as shown in the board's queue list."""

    id = serializers.UUIDField()
    number = serializers.CharField()
    category_id = serializers.IntegerField()


class DisplaySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisplaySettings
        fields = [
            "youtube_url", "org_name", "ticker_text", "voice_enabled", "voice_lang",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_id = serializers.PrimaryKeyRelatedField(
        source="actor", read_only=True, allow_null=True
    )

    class Meta:
        model = AuditLog
        fields = ["id", "actor_id", "actor_label", "action", "target", "meta", "created_at"]


class DisplayBoardCounterSerializer(serializers.Serializer):
    """One window on the board: the counter + its current call (or null)."""

    counter_id = serializers.IntegerField(source="id")
    counter_number = serializers.CharField(source="number")
    counter_name = serializers.CharField(source="name")
    current = DisplayCallSerializer(allow_null=True)


class WorkScheduleSerializer(serializers.ModelSerializer):
    """A planned recurring shift. Read includes denormalised labels so the admin
    table needs no extra lookups; write takes ids."""

    user_id = serializers.PrimaryKeyRelatedField(
        source="user", queryset=User.objects.all()
    )
    counter_id = serializers.PrimaryKeyRelatedField(
        source="counter", queryset=Counter.objects.all()
    )
    hall_id = serializers.PrimaryKeyRelatedField(source="hall", read_only=True)
    user_name = serializers.SerializerMethodField()
    counter_number = serializers.CharField(source="counter.number", read_only=True)
    weekday_label = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = WorkSchedule
        fields = [
            "id", "user_id", "user_name", "counter_id", "counter_number",
            "hall_id", "weekday", "weekday_label", "start_time", "end_time",
            "is_active",
        ]

    def get_user_name(self, obj) -> str:
        return obj.user.name or obj.user.username

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError(
                {"end_time": "Конец смены должен быть позже начала"}
            )
        return attrs
