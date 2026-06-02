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

    class Meta:
        model = User
        fields = ["id", "username", "name", "role", "counter_id", "is_active"]

    def create(self, validated_data):
        user = User(**validated_data)
        user.set_password("operator")  # default; admin manages real creds later
        user.save()
        return user

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
