import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User

def test_manager_subordinate_visibility():
    parent_manager = User.objects.filter(role='manager').first()
    if not parent_manager:
        print("No manager found")
        return

    print(f"Parent Manager: {parent_manager.email}")
    
    # Create an employee subordinate
    emp_sub = User.objects.get_or_create(
        email='sub_emp@example.com',
        defaults={'first_name': 'Sub', 'last_name': 'Emp', 'role': 'employee', 'manager': parent_manager}
    )[0]
    
    # Create a manager subordinate
    mgr_sub = User.objects.get_or_create(
        email='sub_mgr@example.com',
        defaults={'first_name': 'Sub', 'last_name': 'Mgr', 'role': 'manager', 'manager': parent_manager}
    )[0]
    
    # Check subordinates list
    subordinate_ids = list(parent_manager.subordinates.values_list('id', flat=True))
    print(f"Subordinate IDs: {subordinate_ids}")
    print(f"Employee ID in list: {emp_sub.id in subordinate_ids}")
    print(f"Manager ID in list: {mgr_sub.id in subordinate_ids}")

    # Simulate TeamTimesheetView filter
    team = User.objects.filter(id__in=subordinate_ids, is_active=True)
    print(f"Team count: {team.count()}")
    for member in team:
        print(f" - {member.email} ({member.role})")

if __name__ == "__main__":
    test_manager_subordinate_visibility()
