"""JWT authentication for WebSocket connections.

The browser can't set an `Authorization` header on a WebSocket handshake, so the
frontends pass the access token in the query string: `ws/operator?token=<jwt>`.
This middleware resolves it to `scope["user"]` (or AnonymousUser) before the
consumer runs. The consumer then decides which groups require a real user
(operator/admin) and which stay public (display board in the hall).
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(raw_token: str):
    # Imported lazily — the app registry must be ready before these load.
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    from accounts.models import User

    try:
        token = AccessToken(raw_token)
        return User.objects.get(id=token["user_id"])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Populate scope["user"] from a `token` query param. Falls back to
    AnonymousUser when the token is missing or invalid — the consumer enforces
    access, not this middleware."""

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        tokens = query.get("token")
        scope["user"] = (
            await _user_from_token(tokens[0]) if tokens else AnonymousUser()
        )
        return await super().__call__(scope, receive, send)
