import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache

class StatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Global updates group
        self.group_name = 'status_updates'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # PASSIVE AUTOMATION: Trigger policy checks whenever someone logs in
        await self.trigger_passive_automation()

    async def trigger_passive_automation(self):
        from .services import AttendanceService
        # Run cleanup tasks silently in the background
        try:
            await database_sync_to_async(AttendanceService.auto_checkout_all_active_sessions)()
            await database_sync_to_async(AttendanceService.notify_upcoming_shifts)()
        except Exception:
            pass

    async def disconnect(self, close_code):
        # Leave global group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        
        # Leave private group if joined
        if hasattr(self, 'user_id'):
            await self.channel_layer.group_discard(f'user_{self.user_id}', self.channel_name)
            # Notify others we're offline
            cache.delete(f'presence_{self.user_id}')
            await self.trigger_status_broadcast(self.user_id)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            m_type = data.get('type')
            
            if m_type == 'presence':
                user_id = data.get('user_id')
                if user_id:
                    # Join private group on first heartbeat
                    if not hasattr(self, 'user_id'):
                        self.user_id = user_id
                        await self.channel_layer.group_add(f'user_{user_id}', self.channel_name)
                    
                    cache.set(f'presence_{user_id}', True, 60)
                    await self.trigger_status_broadcast(user_id)

        except Exception:
            pass

    async def trigger_status_broadcast(self, user_id):
        from .models import User
        from .services import StatusService
        try:
            user = await database_sync_to_async(User.objects.get)(id=user_id)
            await database_sync_to_async(StatusService.broadcast_status_change)(user)
        except Exception:
            pass

    async def status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'user_id': event['user_id'],
            'status': event['status'],
        }))

    async def notification_alert(self, event):
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
        await self.send(text_data=json.dumps({ 'type': 'policy_update' }))


