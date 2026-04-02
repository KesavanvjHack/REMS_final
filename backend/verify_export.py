import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, Holiday
from datetime import date

def verify_exports():
    admin = User.objects.filter(role='admin').first()
    if not admin:
        print("No admin found for testing")
        return

    print(f"Testing ExportView with admin: {admin.email}")
    
    # Create some dummy data if needed
    Holiday.objects.get_or_create(name='Test Holiday', date=date.today())
    
    # We can't easily call the view via requests without a token, 
    # but we can simulate the view logic or use APIClient if we were in a test suit.
    # Here I will just check if the methods exist and are reachable.
    
    from core.views import ExportView
    view = ExportView()
    
    # Mock a request object
    class MockRequest:
        def __init__(self, user, params):
            self.user = user
            self.query_params = params

    # Test Attendance Export
    req = MockRequest(admin, {'type': 'attendance', 'export_format': 'csv'})
    resp = view._export_attendance(req, None, None, 'csv')
    print(f"Attendance Export Status: {resp.status_code}")
    print(f"Attendance Export Content Type: {resp['Content-Type']}")
    
    # Test Holiday Export
    req = MockRequest(admin, {'type': 'holiday', 'export_format': 'csv'})
    resp = view._export_holiday(req, 'csv')
    print(f"Holiday Export Status: {resp.status_code}")
    print(f"Holiday Export Content Type: {resp['Content-Type']}")

if __name__ == "__main__":
    verify_exports()
