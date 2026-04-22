from rest_framework import serializers
from .models import MonitoringSession
from core.serializers import UserListSerializer

class MonitoringSessionSerializer(serializers.ModelSerializer):
    employee_details = UserListSerializer(source='employee', read_only=True)
    
    class Meta:
        model = MonitoringSession
        fields = [
            'id', 'employee', 'employee_details', 
            'shift_start', 'shift_end', 'room_id', 
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
