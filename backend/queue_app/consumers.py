from channels.generic.websocket import AsyncJsonWebsocketConsumer


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    """One consumer for all three audiences. The group is chosen by the URL
    (`display` / `operators` / `admin`). Messages are lightweight triggers —
    the client refetches over REST on receipt."""

    # Groups carrying staff data/actions require an authenticated user (JWT in
    # the `token` query param). The public hall board stays open.
    PROTECTED_GROUPS = {"operators", "admin"}

    async def connect(self):
        self.group = self.scope["url_route"]["kwargs"]["group"]
        if self.group in self.PROTECTED_GROUPS:
            user = self.scope.get("user")
            if user is None or not user.is_authenticated:
                # 4401 = app-level "unauthorized"; the client won't reconnect-spam.
                await self.close(code=4401)
                return
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def broadcast(self, message):
        """Handler for group_send(type="broadcast"). Forwards the event name."""
        await self.send_json({"event": message.get("event", "changed")})
