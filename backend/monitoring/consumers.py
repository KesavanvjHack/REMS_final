import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'monitor_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            # Notify others in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'peer_disconnected',
                    'sender_channel_name': self.channel_name
                }
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        message_type = data.get('type')

        # Relay message to others in the room
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'signal_message',
                    'message': data,
                    'sender_channel_name': self.channel_name
                }
            )

    async def signal_message(self, event):
        message = event['message']
        sender_channel_name = event['sender_channel_name']

        # Send only to others
        if self.channel_name != sender_channel_name:
            await self.send(text_data=json.dumps(message))

    async def peer_disconnected(self, event):
        # Notify that a peer has left
        await self.send(text_data=json.dumps({
            'type': 'peer-left',
            'info': 'A peer has disconnected'
        }))
