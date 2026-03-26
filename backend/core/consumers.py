import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache

class StatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Add to the global broadcast group
        self.group_name = 'status_updates'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def trigger_status_broadcast(self, user_id):
        """Helper to trigger StatusService broadcast from async consumer."""
        from .models import User
        from .services import StatusService
        try:
            user = await database_sync_to_async(User.objects.get)(id=user_id)
            await database_sync_to_async(StatusService.broadcast_status_change)(user)
        except Exception:
            pass

    async def disconnect(self, close_code):
        # Remove from the global broadcast group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """Handle presence heartbeats from clients."""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'presence':
                user_id = data.get('user_id')
                if user_id:
                    # Store user ID in cache with a 60-second TTL
                    cache.set(f'presence_{user_id}', True, 60)
                    # Broadcast immediately to all listeners
                    await self.trigger_status_broadcast(user_id)
        except Exception:
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

    async def policy_update(self, event):
        """
        Broadcast that a global policy has been updated.
        """
        await self.send(text_data=json.dumps({
            'type': 'policy_update'
        }))
