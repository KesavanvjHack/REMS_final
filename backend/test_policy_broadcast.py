import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import AttendancePolicy
from core.services import StatusService

def test_broadcast():
    print("Fetching active policy...")
    policy = AttendancePolicy.objects.filter(is_active=True).first()
    if not policy:
        print("No active policy found. Creating one...")
        policy = AttendancePolicy.objects.create(name="Test Policy", is_active=True)
    
    print(f"Saving policy: {policy.name}")
    # This should trigger the broadcast_policy_update via the overridden save()
    policy.save()
    print("Policy saved successfully.")

if __name__ == "__main__":
    test_broadcast()
