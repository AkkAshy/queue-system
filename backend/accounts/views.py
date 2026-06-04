from datetime import datetime, timezone

from django.contrib.auth import authenticate
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from .models import User
from .permissions import IsChief
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    UserSerializer,
    UserWriteSerializer,
)


class LoginView(APIView):
    """POST /api/auth/login → { token, username, role, expires_at } (matches the
    frontend contract, not raw SimpleJWT)."""

    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            username=ser.validated_data["username"],
            password=ser.validated_data["password"],
        )
        if user is None:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )
        token = AccessToken.for_user(user)
        expires_at = datetime.fromtimestamp(token["exp"], tz=timezone.utc)
        # Lazy import avoids a module-load cycle (accounts ↔ queue_app).
        from queue_app import audit
        audit.log(request, "auth.login", target=user.username, actor_label=user.username)
        return Response(
            {
                "token": str(token),
                "user_id": user.id,
                "username": user.username,
                "name": user.name,
                "role": user.role,
                "counter_id": user.counter_id,
                "hall_id": user.hall_id,
                "expires_at": expires_at.isoformat(),
            }
        )


class ChangePasswordView(APIView):
    """POST /api/auth/change-password — any signed-in account changes its OWN
    password (current + new). Self-service; chief resets others via /api/users."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        from queue_app import audit
        audit.log(request, "auth.password_changed", target=request.user.username)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("id")
    permission_classes = [IsChief]  # accounts are chief-only

    def get_serializer_class(self):
        return UserWriteSerializer if self.request.method == "POST" else UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserWriteSerializer
    permission_classes = [IsChief]

    def perform_update(self, serializer):
        # Flag a chief-initiated password reset in the audit trail.
        reset = bool(serializer.validated_data.get("password"))
        user = serializer.save()
        from queue_app import audit
        action = "user.password_reset" if reset else "user.updated"
        audit.log(self.request, action, target=user.username)
