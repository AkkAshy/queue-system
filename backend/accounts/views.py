from datetime import datetime, timezone

from django.contrib.auth import authenticate
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from .models import User
from .serializers import LoginSerializer, UserSerializer, UserWriteSerializer


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
                "username": user.username,
                "role": user.role,
                "expires_at": expires_at.isoformat(),
            }
        )


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("id")

    def get_serializer_class(self):
        return UserWriteSerializer if self.request.method == "POST" else UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserWriteSerializer
