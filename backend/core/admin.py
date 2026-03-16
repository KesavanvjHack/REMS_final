"""
Django admin registration for REMS models.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Department, Role, AttendancePolicy, Attendance,
    WorkSession, BreakSession, IdleLog, LeaveRequest, Holiday, AuditLog
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
