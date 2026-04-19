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
    missing_seconds = serializers.SerializerMethodField()
    live_status = serializers.SerializerMethodField()
    first_login = serializers.SerializerMethodField()
    last_logout = serializers.SerializerMethodField()
    shift_start = serializers.SerializerMethodField()
    shift_end = serializers.SerializerMethodField()
    has_completed_session = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'user_email', 'user_name', 'user_role',
            'date', 'status', 'live_status', 'first_login', 'last_logout',
            'shift_start', 'shift_end',
            'total_work_seconds', 'total_break_seconds', 'total_idle_seconds',
            'effective_work_seconds', 'work_hours', 'missing_seconds', 'has_completed_session',
            'is_flagged', 'flag_reason', 'manager_remark',
            'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'total_work_seconds', 'total_break_seconds',
            'total_idle_seconds', 'effective_work_seconds',
            'created_at', 'updated_at',
        ]

    def merge_intervals(self, intervals):
        if not intervals: return []
        intervals.sort(key=lambda x: x[0])
        merged = [list(intervals[0])]
        for next_start, next_end in intervals[1:]:
            prev_start, prev_end = merged[-1]
            if next_start < prev_end:
                merged[-1][1] = max(prev_end, next_end)
            else:
                merged.append([next_start, next_end])
        return merged

    def sum_intervals(self, intervals):
        return sum((end - start).total_seconds() for start, end in intervals)

    def get_gross_seconds(self, obj):
        """Returns Gross Logged-in Seconds by calculating the Union of all sessions"""
        now = timezone.now()
        intervals = [(s.start_time, s.end_time or now) for s in obj.work_sessions.all() if (s.end_time or now) > s.start_time]
        return int(self.sum_intervals(self.merge_intervals(intervals)))

    def get_total_work_seconds(self, obj):
        """Returns Net Productive Seconds: Gross - Breaks - Idle"""
        gross = self.get_gross_seconds(obj)
        breaks = self.get_total_break_seconds(obj)
        idle = self.get_total_idle_seconds(obj)
        return max(0, gross - breaks - idle)

    def get_total_break_seconds(self, obj):
        """Returns total break seconds by summing all break logs"""
        now = timezone.now()
        total = 0
        for ws in obj.work_sessions.all():
            for bs in ws.break_sessions.all():
                end = bs.end_time or now
                # Match recalculate_status intersection logic for consistency
                ws_start = ws.start_time
                ws_end = ws.end_time or now
                eff_start = max(bs.start_time, ws_start)
                eff_end = min(end, ws_end)
                if eff_end > eff_start:
                    total += int((eff_end - eff_start).total_seconds())
        return total

    def get_total_idle_seconds(self, obj):
        """Returns total idle seconds by summing union of logs intersected with work"""
        now = timezone.now()
        all_idles = []
        for ws in obj.work_sessions.all():
            ws_start, ws_end = ws.start_time, ws.end_time or now
            for il in ws.idle_logs.all():
                il_start, il_end = il.start_time, il.end_time or now
                eff_start = max(il_start, ws_start)
                eff_end = min(il_end, ws_end)
                if eff_end > eff_start:
                    all_idles.append((eff_start, eff_end))
        return int(self.sum_intervals(self.merge_intervals(all_idles)))

    def get_effective_work_seconds(self, obj):
        """Redundant but kept for internal calls: Returns Net Productive Seconds"""
        return self.get_total_work_seconds(obj)

    def get_work_hours(self, obj):
        """Returns Effective (Net) hours for reports/dashboard."""
        total = self.get_total_work_seconds(obj)
        return round(total / 3600, 2)

    def get_missing_seconds(self, obj):
        """Calculate time gap: Shift Window Duration - Intersection(Work, Shift Window)"""
        from .models import AttendancePolicy
        import datetime
        from django.utils import timezone as django_timezone
        
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if not policy:
            return 0
            
        # 1. Shift Window Definition (Local to the attendance date)
        att_date = obj.date 
        tz = django_timezone.get_current_timezone()
        shift_start = django_timezone.make_aware(datetime.datetime.combine(att_date, policy.shift_start_time), tz)
        shift_end = django_timezone.make_aware(datetime.datetime.combine(att_date, policy.shift_end_time), tz)
        
        if shift_end <= shift_start: 
            shift_end += datetime.timedelta(days=1)
            
        # 2. Live Adaptation (Time-Passed Logic)
        # For 'Today', we only compare work against the time that has ALREADY PASSED
        now = django_timezone.now()
        
        # Determine the moment in the shift we are currently evaluating
        # (Capped at shift_end for past/completed days)
        effective_now = min(now, shift_end)
        
        # Baseline: How many seconds SHOULD have been worked so far?
        # If the shift hasn't started yet, expected time is 0.
        expected_duration_so_far = max(0, (effective_now - shift_start).total_seconds())
        
        # 3. Intersection Math: Only count work sessions that happened WITHIN the shift window
        sessions = [(s.start_time, s.end_time or now) for s in obj.work_sessions.all() if (s.end_time or now) > s.start_time]
        merged_presence = self.merge_intervals(sessions)
        
        intersection_duration = 0
        for start, end in merged_presence:
            # Shift window intersection (Capped at shift_end)
            win_start = max(start, shift_start)
            win_end = min(end, shift_end)
            if win_end > win_start:
                intersection_duration += (win_end - win_start).total_seconds()
        
        # 4. Gap Result
        # Gap = (Target Time Passed) - (Actual Work during that time)
        return max(0, int(expected_duration_so_far - intersection_duration))

    def get_live_status(self, obj):
        active_session = obj.work_sessions.filter(end_time__isnull=True).first()
        
        if active_session:
            if active_session.break_sessions.filter(end_time__isnull=True).exists():
                return 'On Break'
            if active_session.idle_logs.filter(end_time__isnull=True).exists():
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
        sessions = list(obj.work_sessions.all())
        ended_sessions = [s for s in sessions if s.end_time is not None]
        if not ended_sessions:
            return None
        last_ended = max(ended_sessions, key=lambda s: s.end_time)
        return last_ended.end_time.isoformat()

    def get_shift_start(self, obj):
        from .models import AttendancePolicy
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        return policy.shift_start_time.strftime('%I:%M %p') if policy else "09:30 AM"

    def get_shift_end(self, obj):
        from .models import AttendancePolicy
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        return policy.shift_end_time.strftime('%I:%M %p') if policy else "05:30 PM"

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
    duration_seconds = serializers.ReadOnlyField()
    ip_address = serializers.ReadOnlyField()

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
    ip_address = serializers.ReadOnlyField()

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
    AppUsageLog, Alert, Document, Expense, Department, Notification,
    ScreenCapture
)

class IPWhitelistSerializer(serializers.ModelSerializer):
    ip_address = serializers.CharField() # Use CharField to avoid DRF GenericIPAddressField bug

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


class ScreenCaptureSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = ScreenCapture
        fields = ['id', 'user', 'user_name', 'user_email', 'work_session', 'image', 'timestamp']
        read_only_fields = ['id', 'user', 'user_name', 'user_email', 'timestamp']
