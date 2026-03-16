import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

class StatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Add to the global broadcast group
        self.group_name = 'status_updates'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Remove from the global broadcast group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        # Handle ping/pong if necessary, or client requests for state
        # In this implementation, the backend services will push events down.
        pass

    async def status_update(self, event):
        """
        Broadcast a user's status change down to connected WebSocket clients.
        Expected event format:
        {
            'type': 'status_update',
            'user_id': str,
            'status': str,
            'timestamp': str
        }
        """
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'user_id': event['user_id'],
            'status': event['status'],
        }))

    async def notification_alert(self, event):
        """Ignore notifications on the status socket."""
        pass

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'status_updates'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        pass

    async def status_update(self, event):
        """Ignore status updates on the notification socket."""
        pass

    async def notification_alert(self, event):
        """
        Broadcast a new notification to listeners.
        """
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification_id': event['notification_id'],
            'recipient_id': event['recipient_id'],
            'title': event['title'],
            'message': event['message'],
            'notif_type': event['notif_type'],
            'sender_name': event['sender_name']
        }))
