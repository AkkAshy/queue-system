from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Matches the `User` contract: { id, username, name, role, counter_id, is_active }."""

    counter_id = serializers.PrimaryKeyRelatedField(
        source="counter", read_only=True, allow_null=True
    )
    hall_id = serializers.PrimaryKeyRelatedField(
        source="hall", read_only=True, allow_null=True
    )

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "counter_id", "hall_id", "is_active"]


class UserWriteSerializer(serializers.ModelSerializer):
    counter_id = serializers.IntegerField(required=False, allow_null=True)
    # Hall the account is scoped to (head-of-hall / hall_admin).
    hall_id = serializers.IntegerField(required=False, allow_null=True)
    # Chief may set/reset an account's password inline (create or update). Never
    # echoed back. Optional on update — omit to leave the password untouched.
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "counter_id", "hall_id", "is_active", "password"]

    @staticmethod
    def _derive_hall(validated_data):
        """An operator belongs to the hall of their counter — derive it so the
        hall_admin scoping (which filters users by hall) catches them, unless a
        hall was set explicitly (e.g. for a hall_admin head account)."""
        if validated_data.get("hall_id") is None and validated_data.get("counter_id"):
            from queue_app.models import Counter
            counter = Counter.objects.filter(id=validated_data["counter_id"]).first()
            if counter:
                validated_data["hall_id"] = counter.hall_id

    def create(self, validated_data):
        # An explicit password wins; otherwise fall back to the legacy default.
        password = validated_data.pop("password", None) or "operator"
        self._derive_hall(validated_data)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        self._derive_hall(validated_data)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    """Self-service password change: verify the current password, then set a new
    one that passes Django's validators."""

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Текущий пароль неверный")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
