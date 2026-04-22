from django.db import models
import uuid
from core.models import User

class MonitoringSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monitoring_sessions')
    shift_start = models.DateTimeField()
    shift_end = models.DateTimeField()
    room_id = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'monitoring_sessions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Session: {self.employee.email} ({self.room_id})"
