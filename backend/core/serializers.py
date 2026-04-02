"""
DRF Serializers for all REMS models.
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from .models import (
    User, Department, Role, AttendancePolicy, Attendance,
    WorkSession, BreakSession, IdleLog, LeaveRequest, Holiday, AuditLog
)


# ── Department ─────────────────────────────────────────────────────────────────

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ── Role ───────────────────────────────────────────────────────────────────────

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ── User ───────────────────────────────────────────────────────────────────────

class UserListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'department', 'department_name',
            'manager', 'manager_name', 'phone', 'is_active',
            'is_online', 'last_seen',
            'date_joined', 'created_at',
        ]
        read_only_fields = ['id', 'full_name', 'date_joined', 'created_at']

    def get_manager_name(self, obj):
        return obj.manager.full_name if obj.manager else None


class UserDetailSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'department', 'department_name',
            'manager', 'manager_name', 'phone', 'is_active',
            'is_online', 'last_seen',
            'date_joined', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'full_name', 'date_joined', 'created_at', 'updated_at']

    def get_manager_name(self, obj):
        return obj.manager.full_name if obj.manager else None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'role',
            'department', 'manager', 'phone',
            'password', 'confirm_password',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirm_password'):
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'role',
            'department', 'manager', 'phone', 'is_active',
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value


# ── Auth ───────────────────────────────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


# ── Attendance Policy ──────────────────────────────────────────────────────────

class AttendancePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendancePolicy
        fields = [
            'id', 'name', 'min_working_hours', 'present_hours', 'half_day_hours',
            'idle_threshold_minutes', 'shift_start_time', 'shift_end_time',
            'session_timeout_hours', 'is_active', 'department', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ── Attendance ─────────────────────────────────────────────────────────────────

class AttendanceSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    
    total_work_seconds = serializers.SerializerMethodField()
    total_break_seconds = serializers.SerializerMethodField()
    total_idle_seconds = serializers.SerializerMethodField()
    effective_work_seconds = serializers.SerializerMethodField()
    work_hours = serializers.SerializerMethodField()
    live_status = serializers.SerializerMethodField()
    first_login = serializers.SerializerMethodField()
    last_logout = serializers.SerializerMethodField()
    has_completed_session = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'user_email', 'user_name', 'user_role',
            'date', 'status', 'live_status', 'first_login', 'last_logout',
            'total_work_seconds', 'total_break_seconds', 'total_idle_seconds',
            'effective_work_seconds', 'work_hours', 'has_completed_session',
            'is_flagged', 'flag_reason', 'manager_remark',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'total_work_seconds', 'total_break_seconds',
            'total_idle_seconds', 'effective_work_seconds',
            'created_at', 'updated_at',
        ]

    def get_total_work_seconds(self, obj):
        total = obj.total_work_seconds
        # Use .all() to leverage prefetch cache
        sessions = list(obj.work_sessions.all())
        latest_session = sessions[0] if sessions else None
        
        if latest_session and latest_session.end_time is None:
            total += int((timezone.now() - latest_session.start_time).total_seconds())
        return total

    def get_total_break_seconds(self, obj):
        total = obj.total_break_seconds
        sessions = list(obj.work_sessions.all())
        latest_session = sessions[0] if sessions else None
        
        if latest_session and latest_session.end_time is None:
            # Use .all() on pre-ordered prefetch
            breaks = list(latest_session.break_sessions.all())
            latest_break = breaks[0] if breaks else None
            if latest_break and latest_break.end_time is None:
                total += int((timezone.now() - latest_break.start_time).total_seconds())
        return total

    def get_total_idle_seconds(self, obj):
        total = obj.total_idle_seconds
        sessions = list(obj.work_sessions.all())
        latest_session = sessions[0] if sessions else None
        
        if latest_session and latest_session.end_time is None:
            # Use .all() on pre-ordered prefetch
            idles = list(latest_session.idle_logs.all())
            latest_idle = idles[0] if idles else None
            if latest_idle and latest_idle.end_time is None:
                total += int((timezone.now() - latest_idle.start_time).total_seconds())
        return total

    def get_effective_work_seconds(self, obj):
        work = self.get_total_work_seconds(obj)
        breaks = self.get_total_break_seconds(obj)
        idle = self.get_total_idle_seconds(obj)
        return max(0, work - breaks - idle)

    def get_work_hours(self, obj):
        total = self.get_total_work_seconds(obj)
        return round(total / 3600, 2)

    def get_live_status(self, obj):
        sessions = list(obj.work_sessions.all())
        latest_session = sessions[0] if sessions else None
        
        if latest_session and latest_session.end_time is None:
            breaks = list(latest_session.break_sessions.all())
            latest_break = breaks[0] if breaks else None
            if latest_break and latest_break.end_time is None:
                return 'On Break'
                
            idles = list(latest_session.idle_logs.all())
            latest_idle = idles[0] if idles else None
            if latest_idle and latest_idle.end_time is None:
                return 'Idle'
                
            return 'Working'
        return 'Offline'

    def get_first_login(self, obj):
        # Earliest start_time of any work session on this date
        sessions = list(obj.work_sessions.all())
        if not sessions:
            return None
        first_session = min(sessions, key=lambda s: s.start_time)
        return first_session.start_time.isoformat()

    def get_last_logout(self, obj):
        # Use .all() and filter in memory to find the most recently ended session
        sessions = list(obj.work_sessions.all())
        ended_sessions = [s for s in sessions if s.end_time is not None]
        # sessions are already ordered by -start_time, but we want the one that ended latest
        if not ended_sessions:
            return None
        
        last_ended = max(ended_sessions, key=lambda s: s.end_time)
        return last_ended.end_time.isoformat()

    def get_has_completed_session(self, obj):
        # Use prefetched work_sessions if available
        sessions = list(obj.work_sessions.all())
        return any(s.end_time is not None for s in sessions)


# ── Work Session ───────────────────────────────────────────────────────────────

class BreakSessionSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = BreakSession
        fields = ['id', 'work_session', 'start_time', 'end_time', 'duration_seconds', 'created_at']
        read_only_fields = ['id', 'created_at']


class IdleLogSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = IdleLog
        fields = ['id', 'work_session', 'start_time', 'end_time', 'duration_seconds', 'created_at']
        read_only_fields = ['id', 'created_at']


class WorkSessionSerializer(serializers.ModelSerializer):
    break_sessions = BreakSessionSerializer(many=True, read_only=True)
    idle_logs = IdleLogSerializer(many=True, read_only=True)
    duration_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = WorkSession
        fields = [
            'id', 'attendance', 'start_time', 'end_time',
            'ip_address', 'device_info', 'duration_seconds',
            'break_sessions', 'idle_logs', 'created_at',
        ]
        read_only_fields = ['id', 'ip_address', 'device_info', 'created_at']


# ── Leave Request ──────────────────────────────────────────────────────────────

class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_email = serializers.CharField(source='employee.email', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    reviewer_name = serializers.CharField(source='reviewed_by.full_name', read_only=True, default=None)
    duration_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'employee', 'employee_name', 'employee_email', 'employee_role',
            'leave_type', 'from_date', 'to_date', 'duration_days',
            'reason', 'status', 'reviewed_by', 'reviewer_name',
            'review_comment', 'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'employee', 'status', 'reviewed_by', 'review_comment',
            'reviewed_at', 'created_at', 'updated_at',
        ]


class LeaveApplySerializer(serializers.Serializer):
    leave_type = serializers.ChoiceField(choices=[
        ('casual', 'Casual Leave'), ('sick', 'Sick Leave'), ('annual', 'Annual Leave'),
        ('maternity', 'Maternity Leave'), ('paternity', 'Paternity Leave'),
        ('unpaid', 'Unpaid Leave'), ('other', 'Other'),
    ])
    from_date = serializers.DateField()
    to_date = serializers.DateField()
    reason = serializers.CharField()

    def validate(self, attrs):
        if attrs['from_date'] > attrs['to_date']:
            raise serializers.ValidationError({'to_date': 'End date must be after start date.'})
        return attrs


class LeaveReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    comment = serializers.CharField(required=False, allow_blank=True, default='')


# ── Holiday ─────────────────────────────────────────────────────────────────────

class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'name', 'date', 'description', 'is_optional', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ── Audit Log ──────────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else None

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'action_type', 'description', 'ip_address',
            'user_agent', 'extra_data', 'timestamp',
        ]
        read_only_fields = [
            'id', 'user', 'user_email', 'user_name',
            'action_type', 'description', 'ip_address',
            'user_agent', 'extra_data', 'timestamp',
        ]


# ── Manager Review ─────────────────────────────────────────────────────────────

class AttendanceReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject'], required=False)
    is_flagged = serializers.BooleanField(required=False)
    manager_remark = serializers.CharField(required=False, allow_blank=True)

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 10 Expanded Modules
# ═══════════════════════════════════════════════════════════════════════════════

from .models import (
    User, AttendancePolicy, Attendance, BreakSession, IdleLog, WorkSession,
    LeaveRequest, Holiday, AuditLog, IPWhitelist, Shift, Project, Task,
    AppUsageLog, Alert, Document, Expense, Department, Notification
)

class IPWhitelistSerializer(serializers.ModelSerializer):
    class Meta:
        model = IPWhitelist
        fields = '__all__'

class ShiftSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = Shift
        fields = '__all__'

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = '__all__'

class TaskSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    assigned_to_email = serializers.CharField(source='assigned_to.email', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    class Meta:
        model = Task
        fields = '__all__'

class AppUsageLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    category = serializers.SerializerMethodField()

    class Meta:
        model = AppUsageLog
        fields = '__all__'

    def get_category(self, obj):
        productive_apps = ['vscode', 'github', 'slack', 'notion', 'figma', 'jira', 'chrome', 'rems']
        unproductive_apps = ['youtube', 'netflix', 'facebook', 'twitter', 'instagram', 'reddit', 'game']
        app_lower = obj.app_name.lower()
        if any(x in app_lower for x in productive_apps):
            return 'productive'
        if any(x in app_lower for x in unproductive_apps):
            return 'unproductive'
        return 'neutral'

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = '__all__'

class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    class Meta:
        model = Document
        fields = '__all__'

class ExpenseSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    class Meta:
        model = Expense
        fields = '__all__'

class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    class Meta:
        model = Notification
        fields = '__all__'
