"""
Django admin registration for REMS models with Unfold theme and Import/Export capabilities.
Comprehensive audit and fix for 100% operational status.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from import_export.admin import ImportExportModelAdmin as BaseImportExportModelAdmin
from import_export.admin import ExportMixin as BaseExportMixin

# Safe import: unfold.contrib.import_export forms are only available in newer versions
try:
    from unfold.contrib.import_export.forms import ImportForm, ExportForm
except ImportError:
    from import_export.forms import ImportForm, ExportForm

from unfold.contrib.filters.admin import (
    DropdownFilter,
    ChoicesDropdownFilter,
    RelatedDropdownFilter,
    RangeDateFilter,
)
from .models import (
    User, Department, Role, AttendancePolicy, Attendance,
    WorkSession, BreakSession, IdleLog, LeaveRequest, Holiday, AuditLog,
    IPWhitelist, Shift, Project, Task, AppUsageLog, Alert, 
    Document, Expense, OTPRecord, Notification, ScreenCapture
)
from django import forms
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm, UserChangeForm as BaseUserChangeForm


class UserCreationForm(BaseUserCreationForm):
    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = ("email", "first_name", "last_name", "role")

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError(_("A user with that email already exists."))
        return email


class UserChangeForm(BaseUserChangeForm):
    class Meta(BaseUserChangeForm.Meta):
        model = User
        fields = "__all__"


# ─── Mixins for Unfold + ImportExport ──────────────────────────────────────────

class ImportExportModelAdmin(BaseImportExportModelAdmin, ModelAdmin):
    import_form_class = ImportForm
    export_form_class = ExportForm

class ExportMixin(BaseExportMixin, ModelAdmin):
    export_form_class = ExportForm



# ─── Custom Actions ───────────────────────────────────────────────────────────

@admin.action(description=_("Mark selected as Read"))
def mark_as_read(modeladmin, request, queryset):
    queryset.update(is_read=True)

@admin.action(description=_("Mark selected as Unread"))
def mark_as_unread(modeladmin, request, queryset):
    queryset.update(is_read=False)

@admin.action(description=_("Approve selected requests"))
def approve_requests(modeladmin, request, queryset):
    queryset.update(status='approved', reviewed_at=timezone.now(), reviewed_by=request.user)

@admin.action(description=_("Reject selected requests"))
def reject_requests(modeladmin, request, queryset):
    queryset.update(status='rejected', reviewed_at=timezone.now(), reviewed_by=request.user)


# ─── Admin Classes ────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(BaseUserAdmin, ImportExportModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    list_display = ['email', 'full_name', 'role', 'department', 'is_active', 'date_joined']
    list_filter = [('role', ChoicesDropdownFilter), ('department', RelatedDropdownFilter), 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    compressed_fields = True
    
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
class DepartmentAdmin(ImportExportModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name']

@admin.register(AttendancePolicy)
class AttendancePolicyAdmin(ModelAdmin):
    list_display = ['name', 'min_working_hours', 'half_day_hours', 'idle_threshold_minutes', 'is_active']
    list_filter = ['is_active']

@admin.register(Attendance)
class AttendanceAdmin(ImportExportModelAdmin):
    list_display = ['user', 'date', 'status', 'total_work_seconds', 'is_flagged']
    list_filter = [('status', ChoicesDropdownFilter), 'is_flagged', ('date', RangeDateFilter)]
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    ordering = ['-date']
    actions = [approve_requests, reject_requests]

@admin.register(WorkSession)
class WorkSessionAdmin(ImportExportModelAdmin):
    list_display = ['attendance', 'start_time', 'end_time', 'ip_address']
    ordering = ['-start_time']
    readonly_fields = ['attendance', 'start_time', 'end_time', 'ip_address', 'device_info']

@admin.register(BreakSession)
class BreakSessionAdmin(ModelAdmin):
    list_display = ['work_session', 'start_time', 'end_time', 'duration_seconds']
    ordering = ['-start_time']
    readonly_fields = ['work_session', 'start_time', 'end_time']

@admin.register(IdleLog)
class IdleLogAdmin(ModelAdmin):
    list_display = ['work_session', 'start_time', 'end_time', 'duration_seconds']
    ordering = ['-start_time']
    readonly_fields = ['work_session', 'start_time', 'end_time']

@admin.register(LeaveRequest)
class LeaveRequestAdmin(ImportExportModelAdmin):
    list_display = ['employee', 'leave_type', 'from_date', 'to_date', 'status']
    list_filter = [('status', ChoicesDropdownFilter), 'leave_type']
    search_fields = ['employee__email']
    actions = [approve_requests, reject_requests]

@admin.register(Holiday)
class HolidayAdmin(ImportExportModelAdmin):
    list_display = ['name', 'date', 'is_optional']
    list_filter = ['is_optional']
    ordering = ['date']

@admin.register(AuditLog)
class AuditLogAdmin(ExportMixin, ModelAdmin):
    list_display = ['user', 'action_type', 'description', 'ip_address', 'timestamp']
    list_filter = [('action_type', ChoicesDropdownFilter), ('timestamp', RangeDateFilter)]
    ordering = ['-timestamp']
    readonly_fields = ['user', 'action_type', 'description', 'ip_address', 'timestamp', 'extra_data']

@admin.register(Role)
class RoleAdmin(ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name']

@admin.register(IPWhitelist)
class IPWhitelistAdmin(ImportExportModelAdmin):
    list_display = ['ip_address', 'description', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['ip_address', 'description']

@admin.register(Shift)
class ShiftAdmin(ImportExportModelAdmin):
    list_display = ['name', 'start_time', 'end_time', 'grace_period_minutes', 'department', 'is_active']
    list_filter = ['is_active', ('department', RelatedDropdownFilter)]
    search_fields = ['name']

@admin.register(Project)
class ProjectAdmin(ImportExportModelAdmin):
    list_display = ['name', 'client_code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'client_code']

@admin.register(Task)
class TaskAdmin(ImportExportModelAdmin):
    list_display = ['title', 'project', 'assigned_to', 'status', 'due_date']
    list_filter = [('status', ChoicesDropdownFilter), ('project', RelatedDropdownFilter), ('assigned_to', RelatedDropdownFilter)]
    search_fields = ['title', 'description']

@admin.register(AppUsageLog)
class AppUsageLogAdmin(ImportExportModelAdmin):
    list_display = ['user', 'app_name', 'duration_seconds', 'timestamp']
    list_filter = ['app_name']
    search_fields = ['user__email', 'app_name', 'url']

@admin.register(Alert)
class AlertAdmin(ImportExportModelAdmin):
    list_display = ['user', 'is_read', 'created_at']
    list_filter = ['is_read']
    search_fields = ['user__email', 'message']
    actions = [mark_as_read, mark_as_unread]

@admin.register(Document)
class DocumentAdmin(ImportExportModelAdmin):
    list_display = ['title', 'uploaded_by', 'is_public', 'created_at']
    list_filter = ['is_public']
    search_fields = ['title']

@admin.register(Expense)
class ExpenseAdmin(ImportExportModelAdmin):
    list_display = ['user', 'title', 'amount', 'status', 'created_at']
    list_filter = [('status', ChoicesDropdownFilter)]
    search_fields = ['user__email', 'title']
    actions = [approve_requests, reject_requests]

@admin.register(OTPRecord)
class OTPRecordAdmin(ModelAdmin):
    list_display = ['user_email', 'otp_code', 'is_verified', 'created_at']
    list_filter = ['is_verified']
    search_fields = ['user_email']

@admin.register(Notification)
class NotificationAdmin(ImportExportModelAdmin):
    list_display = ['type', 'recipient', 'sender', 'title', 'is_read', 'created_at']
    list_filter = [('type', ChoicesDropdownFilter), 'is_read']
    search_fields = ['recipient__email', 'sender__email', 'title']
    actions = [mark_as_read, mark_as_unread]

@admin.register(ScreenCapture)
class ScreenCaptureAdmin(ModelAdmin):
    list_display = ['user', 'image_preview', 'timestamp']
    list_filter = [('user', RelatedDropdownFilter), ('timestamp', RangeDateFilter)]
    search_fields = ['user__email']
    readonly_fields = ['user', 'work_session', 'image', 'timestamp', 'image_preview_large']

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width: 100px; height: auto; border-radius: 4px;" />', obj.image.url)
        return "-"
    image_preview.short_description = _("Capture Preview")

    def image_preview_large(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #ddd;" />', obj.image.url)
        return "-"
    image_preview_large.short_description = _("Full Size Capture")
