import os
import django
import sys

# Set up Django environment
sys.path.append('d:\\REMS\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import Attendance
from core.serializers import AttendanceSerializer

def debug_serialization():
    try:
        att = Attendance.objects.first()
        if not att:
            print("No attendance records found to test.")
            return
        
        print(f"Testing serialization for attendance ID: {att.id}")
        serializer = AttendanceSerializer(att)
        data = serializer.data
        print("Serialization Successful!")
    except Exception as e:
        import traceback
        print("Serialization Failed!")
        traceback.print_exc()

if __name__ == "__main__":
    debug_serialization()
