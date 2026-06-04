from rest_framework import serializers

from catalog.models import Hall, Service

from .models import Counter, DisplaySettings, OperatorSession, Ticket


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
        fields = ["youtube_url"]


class DisplayBoardCounterSerializer(serializers.Serializer):
    """One window on the board: the counter + its current call (or null)."""

    counter_id = serializers.IntegerField(source="id")
    counter_number = serializers.CharField(source="number")
    counter_name = serializers.CharField(source="name")
    current = DisplayCallSerializer(allow_null=True)
