import os
import django
import sys

# Setup Django environment
sys.path.append('d:/REMS/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, ScreenCapture
from core.serializers import ScreenCaptureSerializer
from django.db.models import OuterRef, Subquery, Q, Max

def debug_latest():
    try:
        # Simulate an admin user
        admin = User.objects.filter(role='admin').first()
        if not admin:
            print("No admin user found to test with.")
            return

        print(f"Testing as user: {admin.email} ({admin.role})")

        # Get the latest timestamp for each user.
        latest_stamps = ScreenCapture.objects.values('user').annotate(max_ts=Max('timestamp'))
        
        if not latest_stamps:
            print("No screen captures found.")
            return

        filter_q = Q()
        for entry in latest_stamps:
            filter_q |= Q(user_id=entry['user'], timestamp=entry['max_ts'])
        
        latest_captures = ScreenCapture.objects.filter(filter_q).select_related('user')
        
        print(f"Query generated: {latest_captures.query}")
        
        results = list(latest_captures)
        print(f"Found {len(results)} latest captures.")
        
        for cap in results:
            print(f" - {cap.user.email} @ {cap.timestamp}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_latest()
