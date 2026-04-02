import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User
from core.services import NotificationService
from django.db.models import Q

def test_visibility_and_notifications():
    # 1. Ensure we have an admin and a manager
    admin = User.objects.filter(role='admin').first()
    if not admin:
        admin = User.objects.create_superuser(email='admin@example.com', password='password123', first_name='Admin')
        print("Created admin")

    manager = User.objects.filter(role='manager').first()
    if not manager:
        manager = User.objects.create_user(email='manager@example.com', password='password123', first_name='Manager', role='manager')
        print("Created manager")

    # 2. Simulate User creation (Admin creating Employee assigned to Manager)
    new_employee_email = 'new_emp@example.com'
    User.objects.filter(email=new_employee_email).delete()
    
    print(f"Creating employee for manager {manager.email}")
    new_emp = User.objects.create_user(
        email=new_employee_email,
        password='password123',
        first_name='New',
        last_name='Employee',
        role='employee',
        manager=manager
    )
    
    # 3. Check if subordinate is found
    # This simulates TeamStatusView line 715
    subordinate_ids = manager.subordinates.values_list('id', flat=True)
    print(f"Manager subordinates IDs: {list(subordinate_ids)}")
    
    if new_emp.id in subordinate_ids:
        print("SUCCESS: New employee is in manager's subordinates list.")
    else:
        print("FAILURE: New employee NOT found in manager's subordinates list.")

    # 4. Check notifications
    from core.models import Notification
    notif = Notification.objects.filter(recipient=manager, title__icontains="New User").first()
    if notif:
        print(f"SUCCESS: Notification found for manager: {notif.title} - {notif.message}")
    else:
        # Wait, my perform_create in UserViewSet is NOT called when using User.objects.create_user
        # I need to verify if calling the service directly works
        print("Checking manual service call...")
        NotificationService.notify_based_on_role(new_emp, "Test Title", "Test Message", sender=admin)
        notif = Notification.objects.filter(recipient=manager, title="Test Title").first()
        if notif:
            print("SUCCESS: Service manual call works.")
        else:
            print("FAILURE: Service manual call failed to notify manager.")

if __name__ == "__main__":
    test_visibility_and_notifications()
