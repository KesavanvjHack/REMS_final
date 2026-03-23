"""
Django admin registration for REMS models.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Department, Role, AttendancePolicy, Attendance,
    WorkSession, BreakSession, IdleLog, LeaveRequest, Holiday, AuditLog,
    IPWhitelist, Shift, Project, Task, AppUsageLog, Alert, 
    Document, Expense, OTPRecord, Notification
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'department', 'is_active', 'date_joined']
    list_filter = ['role', 'department', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone')}),
        ('Role & Org', {'fields': ('role', 'department', 'manager')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name']


@admin.register(AttendancePolicy)
class AttendancePolicyAdmin(admin.ModelAdmin):
    list_display = ['name', 'min_working_hours', 'half_day_hours', 'idle_threshold_minutes', 'is_active']


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'status', 'total_work_seconds', 'is_flagged']
    list_filter = ['status', 'is_flagged', 'date']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    ordering = ['-date']


@admin.register(WorkSession)
class WorkSessionAdmin(admin.ModelAdmin):
    list_display = ['attendance', 'start_time', 'end_time', 'ip_address']
    ordering = ['-start_time']


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ['employee', 'leave_type', 'from_date', 'to_date', 'status']
    list_filter = ['status', 'leave_type']
    search_fields = ['employee__email']


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'is_optional']
    ordering = ['date']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action_type', 'description', 'ip_address', 'timestamp']
    list_filter = ['action_type']
    ordering = ['-timestamp']
    def get_readonly_fields(self, request, obj=None):
        if obj:
            return [field.name for field in AuditLog._meta.concrete_fields]
        return []

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']

@admin.register(IPWhitelist)
class IPWhitelistAdmin(admin.ModelAdmin):
    list_display = ['ip_address', 'description', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['ip_address', 'description']

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_time', 'end_time', 'grace_period_minutes', 'department', 'is_active']
    list_filter = ['is_active', 'department']
    search_fields = ['name']

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'client_code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'client_code']

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'assigned_to', 'status', 'due_date']
    list_filter = ['status', 'project', 'assigned_to']
    search_fields = ['title', 'description']

@admin.register(AppUsageLog)
class AppUsageLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'app_name', 'duration_seconds', 'timestamp']
    list_filter = ['app_name']
    search_fields = ['user__email', 'app_name', 'url']

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_read', 'created_at']
    list_filter = ['is_read']
    search_fields = ['user__email', 'message']

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'uploaded_by', 'is_public', 'created_at']
    list_filter = ['is_public']
    search_fields = ['title']

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'amount', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['user__email', 'title']

@admin.register(OTPRecord)
class OTPRecordAdmin(admin.ModelAdmin):
    list_display = ['user_email', 'otp_code', 'is_verified', 'created_at']
    list_filter = ['is_verified']
    search_fields = ['user_email']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['type', 'recipient', 'sender', 'title', 'is_read', 'created_at']
    list_filter = ['type', 'is_read']
    search_fields = ['recipient__email', 'sender__email', 'title']
