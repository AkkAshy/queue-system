from channels.generic.websocket import AsyncJsonWebsocketConsumer


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    """One consumer for all three audiences. The group is chosen by the URL
    (`display` / `operators` / `admin`). Messages are lightweight triggers —
    the client refetches over REST on receipt."""

    async def connect(self):
        self.group = self.scope["url_route"]["kwargs"]["group"]
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        group = getattr(self, "group", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def broadcast(self, message):
        """Handler for group_send(type="broadcast"). Forwards the event name."""
        await self.send_json({"event": message.get("event", "changed")})
