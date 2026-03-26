import os
import sys

# Add the project root to sys.path
sys.path.append(os.getcwd())

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()
from core.models import AttendancePolicy, AuditLog, Notification
from core.services import NotificationService

def verify():
    # 1. Setup Admin user
    admin = User.objects.filter(role='admin').first()
    if not admin:
        print("No admin user found.")
        return

    # 2. Setup Policy
    policy = AttendancePolicy.objects.filter(is_active=True).first()
    if not policy:
        print("No active policy found.")
        return

    old_idle = policy.idle_threshold_minutes
    new_idle = (old_idle + 1) if old_idle < 60 else 5
    
    print(f"Updating policy '{policy.name}': Idle Threshold {old_idle} → {new_idle}")
    
    # 3. Use APIClient to trigger perform_update
    client = APIClient()
    client.force_authenticate(user=admin)
    
    # Force the URL to include /api/ if needed, but router.register(r'policy') usually means /api/policy/
    url = f'/api/policy/{policy.id}/'
    response = client.patch(url, {'idle_threshold_minutes': new_idle}, format='json')
    
    if response.status_code == 200:
        print("Policy update successful via API.")
    else:
        # Try without /api/ prefix if /api/ fails
        url = f'/policy/{policy.id}/'
        response = client.patch(url, {'idle_threshold_minutes': new_idle}, format='json')
        if response.status_code == 200:
             print("Policy update successful via API (no /api/ prefix).")
        else:
             print(f"Policy update failed: {response.status_code} - {response.data}")
             return

    # 4. Verify Audit Log
    latest_audit = AuditLog.objects.filter(action_type='policy_change').order_by('-timestamp').first()
    if latest_audit:
        print(f"Latest Audit Log: {latest_audit.description}")
        # Check if the description or extra_data contains the change
        diff_found = str(old_idle) in str(latest_audit.extra_data) and str(new_idle) in str(latest_audit.extra_data)
        if diff_found:
            print(f"Audit Log Diff Verified.")
        else:
            print(f"Audit Log Diff MISSING in extra_data: {latest_audit.extra_data}")
    else:
        print("No Audit Log found for 'policy_change'.")

    # 5. Verify Notifications
    notifs = Notification.objects.filter(title="Policy Rule Updated").order_by('-created_at')[:5]
    if notifs.exists():
        print(f"Found {notifs.count()} notifications with title 'Policy Rule Updated'.")
        verified = False
        for n in notifs:
            if str(old_idle) in n.message and str(new_idle) in n.message:
                print(f"Notification Content Verified: {n.message[:100]}...")
                verified = True
                break
        if not verified:
            print("Notification Message Content verification FAILED in all recent notifs.")
    else:
        print("Notification verification FAILED: No notification with title 'Policy Rule Updated' found.")

if __name__ == "__main__":
    verify()
