from django.utils import timezone
from core.models import User, Attendance, LeaveRequest, Task


def dashboard_callback(request, context):
    total_employees = User.objects.filter(role='employee').count()
    total_admins = User.objects.filter(role='admin').count()
    pending_leaves = LeaveRequest.objects.filter(status='pending').count()
    open_tasks = Task.objects.exclude(status='done').count()
    today_present = Attendance.objects.filter(
        date=timezone.now().date(), status='present'
    ).count()

    context.update({
        "cards": [
            {"title": "Total Employees", "value": total_employees},
            {"title": "System Admins", "value": total_admins},
            {"title": "Pending Leaves", "value": pending_leaves},
            {"title": "Open Tasks", "value": open_tasks},
            {"title": "Present Today", "value": today_present},
        ],
    })
    return context
