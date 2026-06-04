from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Matches the `User` contract: { id, username, name, role, counter_id, is_active }."""

    counter_id = serializers.PrimaryKeyRelatedField(
        source="counter", read_only=True, allow_null=True
    )

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "counter_id", "is_active"]


class UserWriteSerializer(serializers.ModelSerializer):
    counter_id = serializers.IntegerField(required=False, allow_null=True)
    # Chief may set/reset an account's password inline (create or update). Never
    # echoed back. Optional on update — omit to leave the password untouched.
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "counter_id", "is_active", "password"]

    def create(self, validated_data):
        # An explicit password wins; otherwise fall back to the legacy default.
        password = validated_data.pop("password", None) or "operator"
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
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
