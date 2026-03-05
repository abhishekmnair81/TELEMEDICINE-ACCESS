# api/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(
        r'ws/video/(?P<room_id>[a-zA-Z0-9_-]+)/(?P<user_id>[a-fA-F0-9-]+)/$',
        consumers.VideoConsultationConsumer.as_asgi()
    ),
]