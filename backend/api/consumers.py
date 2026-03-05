#------------------------------------------------------------------------------------

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class VideoConsultationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time video consultation features:
    - WebRTC signaling (offer, answer, ICE candidates)
    - Real-time chat messages
    - Connection status updates
    - Screen sharing notifications
    """

    async def connect(self):
        """Handle WebSocket connection"""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        self.room_group_name = f'video_room_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Notify room that user connected
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_connected',
                'user_id': self.user_id,
                'timestamp': timezone.now().isoformat()
            }
        )

        logger.info(f"User {self.user_id} connected to room {self.room_id}")

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Notify room that user disconnected
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_disconnected',
                'user_id': self.user_id,
                'timestamp': timezone.now().isoformat()
            }
        )

        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        logger.info(f"User {self.user_id} disconnected from room {self.room_id}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'webrtc_offer':
                await self.handle_webrtc_offer(data)
            elif message_type == 'webrtc_answer':
                await self.handle_webrtc_answer(data)
            elif message_type == 'ice_candidate':
                await self.handle_ice_candidate(data)
            elif message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'connection_quality':
                await self.handle_connection_quality(data)
            elif message_type == 'screen_share':
                await self.handle_screen_share(data)
            elif message_type == 'user_status':
                await self.handle_user_status(data)
            else:
                logger.warning(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error handling message: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    @database_sync_to_async
    def get_user_name(self, user_id):
        """Get user's display name"""
        from .models import CustomUser
        try:
            user = CustomUser.objects.get(id=user_id)
            return f"{user.first_name} {user.last_name}".strip() or user.username
        except Exception as e:
            logger.error(f"Error getting user name: {str(e)}")
            return "Unknown User"
    
    # UPDATE connect method to send user_name:
    async def connect(self):
        """Handle WebSocket connection"""
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        self.room_group_name = f'video_room_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Get user name
        user_name = await self.get_user_name(self.user_id)

        # Notify room that user connected
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_connected',
                'user_id': self.user_id,
                'user_name': user_name,  # Added
                'timestamp': timezone.now().isoformat()
            }
        )

        logger.info(f"User {self.user_id} ({user_name}) connected to room {self.room_id}")

    # UPDATE user_connected event handler:
    async def user_connected(self, event):
        """Send user connected notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_connected',
            'user_id': event['user_id'],
            'user_name': event.get('user_name', 'Unknown'),  # Added
            'timestamp': event['timestamp']
        }))
        
    # UPDATE disconnect to send user_name:
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        user_name = await self.get_user_name(self.user_id)
        
        # Notify room that user disconnected
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_disconnected',
                'user_id': self.user_id,
                'user_name': user_name,  # Added
                'timestamp': timezone.now().isoformat()
            }
        )

        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        logger.info(f"User {self.user_id} ({user_name}) disconnected from room {self.room_id}")
        
    # UPDATE user_disconnected event handler:
    async def user_disconnected(self, event):
        """Send user disconnected notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_disconnected',
            'user_id': event['user_id'],
            'user_name': event.get('user_name', 'Unknown'),  # Added
            'timestamp': event['timestamp']
        }))
    # ========================================================================
    # MESSAGE HANDLERS
    # ========================================================================

    async def handle_webrtc_offer(self, data):
        """Handle WebRTC offer"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'webrtc_offer',
                'sender_id': data.get('sender_id'),
                'receiver_id': data.get('receiver_id'),
                'sdp': data.get('sdp'),
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_webrtc_answer(self, data):
        """Handle WebRTC answer"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'webrtc_answer',
                'sender_id': data.get('sender_id'),
                'receiver_id': data.get('receiver_id'),
                'sdp': data.get('sdp'),
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_ice_candidate(self, data):
        """Handle ICE candidate"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ice_candidate',
                'sender_id': data.get('sender_id'),
                'receiver_id': data.get('receiver_id'),
                'candidate': data.get('candidate'),
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_chat_message(self, data):
        """Handle chat message during call"""
        # Save to database
        await self.save_chat_message(data)

        # Broadcast to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_id': data.get('message_id'),
                'sender_id': data.get('sender_id'),
                'sender_name': data.get('sender_name'),
                'content': data.get('content'),
                'message_type': data.get('message_type', 'text'),
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_connection_quality(self, data):
        """Handle connection quality update"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'connection_quality',
                'user_id': data.get('user_id'),
                'quality': data.get('quality'),
                'bandwidth': data.get('bandwidth'),
                'latency': data.get('latency'),
                'packet_loss': data.get('packet_loss'),
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_screen_share(self, data):
        """Handle screen sharing events"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'screen_share',
                'user_id': data.get('user_id'),
                'action': data.get('action'),  # 'start' or 'stop'
                'timestamp': timezone.now().isoformat()
            }
        )

    async def handle_user_status(self, data):
        """Handle user status updates (muted, camera off, etc.)"""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user_id': data.get('user_id'),
                'audio_enabled': data.get('audio_enabled'),
                'video_enabled': data.get('video_enabled'),
                'timestamp': timezone.now().isoformat()
            }
        )

    # ========================================================================
    # EVENT RECEIVERS (from group_send)
    # ========================================================================

    async def user_connected(self, event):
        """Send user connected notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_connected',
            'user_id': event['user_id'],
            'timestamp': event['timestamp']
        }))

    async def user_disconnected(self, event):
        """Send user disconnected notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_disconnected',
            'user_id': event['user_id'],
            'timestamp': event['timestamp']
        }))

    async def webrtc_offer(self, event):
        """Send WebRTC offer to receiver"""
        if event['receiver_id'] == self.user_id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_offer',
                'sender_id': event['sender_id'],
                'sdp': event['sdp'],
                'timestamp': event['timestamp']
            }))

    async def webrtc_answer(self, event):
        """Send WebRTC answer to receiver"""
        if event['receiver_id'] == self.user_id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_answer',
                'sender_id': event['sender_id'],
                'sdp': event['sdp'],
                'timestamp': event['timestamp']
            }))

    async def ice_candidate(self, event):
        """Send ICE candidate to receiver"""
        if event['receiver_id'] == self.user_id:
            await self.send(text_data=json.dumps({
                'type': 'ice_candidate',
                'sender_id': event['sender_id'],
                'candidate': event['candidate'],
                'timestamp': event['timestamp']
            }))

    async def chat_message(self, event):
        """Send chat message to all participants"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message_id': event['message_id'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'content': event['content'],
            'message_type': event['message_type'],
            'timestamp': event['timestamp']
        }))

    async def connection_quality(self, event):
        """Send connection quality update"""
        await self.send(text_data=json.dumps({
            'type': 'connection_quality',
            'user_id': event['user_id'],
            'quality': event['quality'],
            'bandwidth': event.get('bandwidth'),
            'latency': event.get('latency'),
            'packet_loss': event.get('packet_loss'),
            'timestamp': event['timestamp']
        }))

    async def screen_share(self, event):
        """Send screen share notification"""
        await self.send(text_data=json.dumps({
            'type': 'screen_share',
            'user_id': event['user_id'],
            'action': event['action'],
            'timestamp': event['timestamp']
        }))

    async def user_status(self, event):
        """Send user status update"""
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': event['user_id'],
            'audio_enabled': event['audio_enabled'],
            'video_enabled': event['video_enabled'],
            'timestamp': event['timestamp']
        }))

    # ========================================================================
    # DATABASE OPERATIONS
    # ========================================================================

    @database_sync_to_async
    def save_chat_message(self, data):
        """Save chat message to database"""
        from .models import VideoConsultationRoom, VideoCallMessage, CustomUser
        
        try:
            room = VideoConsultationRoom.objects.get(room_id=self.room_id)
            sender = CustomUser.objects.get(id=data.get('sender_id'))
            
            message = VideoCallMessage.objects.create(
                room=room,
                sender=sender,
                content=data.get('content', ''),
                message_type=data.get('message_type', 'text')
            )
            
            return str(message.id)
        except Exception as e:
            logger.error(f"Error saving chat message: {str(e)}")
            return None