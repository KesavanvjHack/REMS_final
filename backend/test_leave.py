import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

import traceback
from core.models import LeaveRequest, User
from core.services import LeaveService

def main():
    manager = User.objects.filter(role='manager').first()
    leave = LeaveRequest.objects.filter(status='pending').first()
    
    if leave and manager:
        print(f"Testing LeaveApproval: {leave.id} by manager {manager.id}")
        try:
            LeaveService.review_leave(leave, manager, 'approve', 'ok', None)
            print('Success!')
        except Exception as e:
            traceback.print_exc()
    else:
        print('No manager or pending leave found. Creating mock leave payload...')
        emp = User.objects.filter(role='employee').first()
        from datetime import date, timedelta
        if emp and manager:
            leave = LeaveRequest.objects.create(
                employee=emp, 
                leave_type='casual', 
                from_date=date.today(), 
                to_date=date.today() + timedelta(days=2),
                reason='Test'
            )
            try:
                LeaveService.review_leave(leave, manager, 'approve', 'ok', None)
                print('Mock leave approved successfully!')
            except Exception as e:
                traceback.print_exc()

if __name__ == '__main__':
    main()
