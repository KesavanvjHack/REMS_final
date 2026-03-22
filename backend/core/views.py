"""
All DRF API views for REMS. Views are thin; business logic lives in services.py.
"""

from django.utils import timezone
from django.db.models import Q
from rest_framework import status, viewsets, generics, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import csv
import io
from datetime import date, timedelta

from .models import (
    User, Department, AttendancePolicy, Attendance,
    WorkSession, BreakSession, IdleLog, LeaveRequest, Holiday, AuditLog, OTPRecord, Notification
)
from .serializers import (
    UserListSerializer, UserDetailSerializer, UserCreateSerializer,
    UserUpdateSerializer, LoginSerializer, ChangePasswordSerializer,
    DepartmentSerializer, AttendancePolicySerializer, AttendanceSerializer,
    WorkSessionSerializer, BreakSessionSerializer, IdleLogSerializer,
    LeaveRequestSerializer, LeaveApplySerializer, LeaveReviewSerializer,
    HolidaySerializer, AuditLogSerializer, AttendanceReviewSerializer, NotificationSerializer,
)
from .permissions import IsAdmin, IsManager, IsEmployee, IsOwnerOrManager
from .services import (
    AttendanceService, WorkSessionService, BreakSessionService,
    IdleService, StatusService, LeaveService, ReportService, AuditService,
    NotificationService
)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 1: AUTH & SECURITY
# ═══════════════════════════════════════════════════════════════════════════════

import random
from django.core.mail import send_mail
from django.conf import settings

class RequestOTPView(APIView):
    """Step 1: Request an OTP for Login or Registration"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # In a real app we'd throttle this.
        # Generate 6 digit OTP
        otp_code = f"{random.randint(100000, 999999)}"
        
        # Save to DB
        OTPRecord.objects.create(user_email=email, otp_code=otp_code)

        # Send Email (Console backend will print this)
        send_mail(
            'Your REMS Verification Code',
            f'Your OTP code is: {otp_code}',
            settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@rems.com',
            [email],
            fail_silently=False,
        )

        # Determine if user exists for frontend logic
        user_exists = User.objects.filter(email=email).exists()
        
        return Response({
            'detail': 'OTP sent successfully.',
            'user_exists': user_exists,
            'otp': otp_code
        })

class VerifyOTPView(APIView):
    """Step 2 (Registration): Verify OTP before collecting profile details"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')

        if not email or not otp_code:
            return Response({'detail': 'Email and OTP are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        record = OTPRecord.objects.filter(user_email=email, otp_code=otp_code, is_verified=False).first()
        if not record:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check expiration (e.g. 10 mins)
        if (timezone.now() - record.created_at).total_seconds() > 600:
            return Response({'detail': 'OTP expired.'}, status=status.HTTP_400_BAD_REQUEST)

        record.is_verified = True
        record.save()
        
        return Response({'detail': 'OTP verified successfully.', 'verified_token': otp_code})


class RegisterProfileView(APIView):
    """Step 3 (Registration): Submit User Details + Verified OTP to finish signup"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('verified_token')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        password = request.data.get('password')

        if not all([email, otp_code, first_name, last_name, password]):
            return Response({'detail': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check OTP was actually verified recently
        record = OTPRecord.objects.filter(user_email=email, otp_code=otp_code, is_verified=True).first()
        if not record:
            return Response({'detail': 'Invalid verification session.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'detail': 'User already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='employee', # Default to employee
            is_active=True
        )

        # Invalidate OTP
        record.delete()
        
        return Response({'detail': 'Registration complete. You can now log in.'}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """JWT login with 2FA OTP verification required."""
    permission_classes = [AllowAny]

    def post(self, request):
        # We expect email, password, AND otp for login flow.
        email = request.data.get('email')
        password = request.data.get('password')
        otp_code = request.data.get('otp')

        if not all([email, password, otp_code]):
            return Response({'detail': 'Email, password, and OTP are required for login.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'detail': 'Account is inactive.'}, status=status.HTTP_403_FORBIDDEN)

        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        # Verify OTP
        record = OTPRecord.objects.filter(user_email=email, otp_code=otp_code, is_verified=False).first()
        if not record:
            return Response({'detail': 'Invalid or expired OTP.'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check expiration (e.g. 10 mins)
        if (timezone.now() - record.created_at).total_seconds() > 600:
            return Response({'detail': 'OTP expired.'}, status=status.HTTP_400_BAD_REQUEST)

        record.is_verified = True
        record.save()
        # Clean up
        OTPRecord.objects.filter(user_email=email).delete()

        # Issue JWT tokens
        refresh = RefreshToken.for_user(user)

        # Module 4: Auto-create attendance on login
        attendance, created = AttendanceService.get_or_create_today(user)

        # Audit log
        AuditService.log(user, 'login', f'User {user.email} logged in with 2FA', request)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role,
                'department': str(user.department_id) if user.department_id else None,
                'department_name': user.department.name if user.department else None,
            },
            'attendance_created': created,
        })


class LogoutView(APIView):
    """Blacklist the refresh token on logout."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            AuditService.log(request.user, 'logout', f'User {request.user.email} logged out', request)
            return Response({'detail': 'Logged out successfully.'})
        except TokenError:
            return Response({'detail': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password changed successfully.'})


class MeView(APIView):
    """Return current user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserDetailSerializer(request.user).data)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 2 & 3: USER MANAGEMENT + ROLE AUTHORIZATION
# ═══════════════════════════════════════════════════════════════════════════════

class UserViewSet(viewsets.ModelViewSet):
    """Full CRUD for users. Admin only for write; Manager read-only."""
    queryset = User.objects.select_related('department', 'manager').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['role', 'department', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['created_at', 'email', 'first_name']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsManager()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        if self.action == 'list':
            return UserListSerializer
        return UserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'manager':
            # Managers can only see their subordinates
            return User.objects.filter(
                Q(manager=user) | Q(id=user.id)
            ).select_related('department', 'manager')
        return super().get_queryset()

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reset_password(self, request, pk=None):
        target_user = self.get_object()
        new_password = request.data.get('new_password')
        if not new_password:
            return Response({'detail': 'new_password required.'}, status=400)
        target_user.set_password(new_password)
        target_user.save()
        AuditService.log(request.user, 'update', f'Password reset for {target_user.email}', request)
        return Response({'detail': 'Password reset successfully.'})


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdmin()]


# ═══════════════════════════════════════════════════════════════════════════════
# Module 4 & 5: ATTENDANCE ENGINE + WORK SESSIONS
# ═══════════════════════════════════════════════════════════════════════════════

class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    """Attendance records — read only. Status is always auto-calculated."""
    serializer_class = AttendanceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'date', 'is_flagged']
    ordering_fields = ['date', 'created_at']
    ordering = ['-date']

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.select_related('user', 'reviewed_by')
        if user.role == 'admin':
            return qs.all()
        if user.role == 'manager':
            subordinate_ids = user.subordinates.values_list('id', flat=True)
            return qs.filter(Q(user=user) | Q(user__in=subordinate_ids))
        return qs.filter(user=user)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get current user's today attendance."""
        today = date.today()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()
        if not attendance:
            return Response({'detail': 'No attendance record for today.'}, status=404)
        return Response(AttendanceSerializer(attendance).data)

    @action(detail=False, methods=['get'])
    def todays_absences(self, request):
        """Get today's absences and leaves for employees and managers."""
        today = date.today()
        
        # 1. Get all active employees and managers
        users = User.objects.filter(is_active=True, role__in=['employee', 'manager'])
        
        # 2. Get today's actual attendance records
        attendances = Attendance.objects.filter(
            user__in=users,
            date=today
        ).select_related('user')
        
        att_map = {a.user_id: a for a in attendances}
        
        # 3. Get any leave requests spanning today
        leaves = LeaveRequest.objects.filter(employee__in=users, from_date__lte=today, to_date__gte=today)
        leave_map = {leave.employee_id: leave for leave in leaves}
        
        result = []
        for u in users:
            att = att_map.get(u.id)
            leave = leave_map.get(u.id)
            
            if leave:
                result.append({
                    'id': f"leave_{u.id}_{today}",
                    'user_name': u.full_name,
                    'user_email': u.email,
                    'user_role': u.role,
                    'status': 'on_leave',
                    'leave_type': leave.get_leave_type_display() if leave else "Leave",
                    'reason': f"The reason is: {leave.reason or leave.get_leave_type_display()}"
                })
            elif att:
                if att.status == Attendance.STATUS_ON_LEAVE:
                    result.append({
                        'id': str(att.id),
                        'user_name': u.full_name,
                        'user_email': u.email,
                        'user_role': u.role,
                        'status': att.status,
                        'leave_type': 'Leave',
                        'reason': f"The reason is: {att.manager_remark or att.flag_reason or 'sick'}"
                    })
                elif att.status == Attendance.STATUS_ABSENT:
                    result.append({
                        'id': str(att.id),
                        'user_name': u.full_name,
                        'user_email': u.email,
                        'user_role': u.role,
                        'status': att.status,
                        'leave_type': 'Absent',
                        'reason': 'late check'
                    })
            else:
                result.append({
                    'id': f"dummy_{u.id}_{today}",
                    'user_name': u.full_name,
                    'user_email': u.email,
                    'user_role': u.role,
                    'status': 'absent',
                    'leave_type': 'Absent',
                    'reason': 'No checking'
                })
                
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def review(self, request, pk=None):
        """Manager reviews and adds remarks to flagged attendance."""
        attendance = self.get_object()
        serializer = AttendanceReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance.manager_remark = serializer.validated_data['manager_remark']
        if 'is_flagged' in serializer.validated_data:
            attendance.is_flagged = serializer.validated_data['is_flagged']
        attendance.reviewed_by = request.user
        attendance.reviewed_at = timezone.now()
        attendance.save(update_fields=['manager_remark', 'is_flagged', 'reviewed_by', 'reviewed_at', 'updated_at'])

        AuditService.log(
            request.user, 'update',
            f'Attendance reviewed for {attendance.user.email} on {attendance.date}',
            request
        )
        return Response(AttendanceSerializer(attendance).data)


class WorkSessionView(APIView):
    """Module 5: Start and Stop work sessions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get today's active work session."""
        today = date.today()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()
        if not attendance:
            return Response({'active_session': None, 'attendance': None})

        open_session = WorkSession.objects.filter(
            attendance=attendance, end_time__isnull=True
        ).first()
        session_data = WorkSessionSerializer(open_session).data if open_session else None
        attendance_data = AttendanceSerializer(attendance).data
        return Response({'active_session': session_data, 'attendance': attendance_data})

    def post(self, request):
        """Start work session."""
        action = request.data.get('action')

        if action == 'start':
            session, created = WorkSessionService.start_session(request.user, request)
            return Response({
                'status': 'started' if created else 'already_running',
                'session': WorkSessionSerializer(session).data,
            })
        elif action == 'stop':
            session, stopped = WorkSessionService.stop_session(request.user)
            if not stopped:
                return Response({'detail': 'No active session to stop.'}, status=400)
            today = date.today()
            attendance = Attendance.objects.get(user=request.user, date=today)
            return Response({
                'status': 'stopped',
                'session': WorkSessionSerializer(session).data,
                'attendance': AttendanceSerializer(attendance).data,
            })
        else:
            return Response({'detail': 'action must be "start" or "stop".'}, status=400)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 6: BREAK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class BreakSessionView(APIView):
    """Start/Stop break within an active work session."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action = request.data.get('action')

        if action == 'start':
            try:
                break_session, created = BreakSessionService.start_break(request.user)
            except ValueError as e:
                return Response({'detail': str(e)}, status=400)

            return Response({
                'status': 'started' if created else 'already_on_break',
                'break_session': BreakSessionSerializer(break_session).data,
            })
        elif action == 'stop':
            break_session, stopped = BreakSessionService.stop_break(request.user)
            if not stopped:
                return Response({'detail': 'No active break to stop.'}, status=400)
            return Response({
                'status': 'stopped',
                'break_session': BreakSessionSerializer(break_session).data,
            })
        else:
            return Response({'detail': 'action must be "start" or "stop".'}, status=400)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 7 & 8: IDLE DETECTION + REAL-TIME STATUS
# ═══════════════════════════════════════════════════════════════════════════════

class IdleView(APIView):
    """Frontend fires this when 15 mins of inactivity detected (or when resumed)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action_type = request.data.get('action')

        if action_type == 'start':
            idle_log, created = IdleService.start_idle(request.user)
            if idle_log is None:
                return Response({'detail': 'No active work session.'}, status=400)
            return Response({
                'status': 'idle_started' if created else 'already_idle',
                'idle_log': IdleLogSerializer(idle_log).data,
            })
        elif action_type == 'stop':
            idle_log, stopped = IdleService.stop_idle(request.user)
            if not stopped:
                return Response({'detail': 'No active idle period.'}, status=400)
            return Response({
                'status': 'resumed',
                'idle_log': IdleLogSerializer(idle_log).data,
            })
        else:
            return Response({'detail': 'action must be "start" or "stop".'}, status=400)


class RealTimeStatusView(APIView):
    """Module 8: Real-time status indicator for dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        target_id = request.query_params.get('user_id')
        if target_id and request.user.role in ('admin', 'manager'):
            try:
                target_user = User.objects.get(id=target_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found.'}, status=404)
        else:
            target_user = request.user

        result = StatusService.get_user_status(target_user)

        # Serialize non-model fields
        attendance_data = AttendanceSerializer(result['attendance']).data if result.get('attendance') else None
        session_data = WorkSessionSerializer(result['session']).data if result.get('session') else None

        return Response({
            'status': result['status'],
            'user_id': str(target_user.id),
            'user_name': target_user.full_name,
            'attendance': attendance_data,
            'session': session_data,
        })


class TeamStatusView(APIView):
    """Get real-time status for all team members (manager/admin)."""
    permission_classes = [IsManager]

    def get(self, request):
        user = request.user
        if user.role == 'admin':
            # Admins see Managers and Employees
            team = User.objects.filter(
                is_active=True, 
                role__in=['manager', 'employee']
            ).select_related('department', 'manager')
        elif user.role == 'manager':
            # Managers see ONLY Employees within their scope (subordinates or department)
            team_scope = Q(manager=user)
            if user.department:
                team_scope |= Q(department=user.department)
            
            team = User.objects.filter(
                team_scope,
                role='employee',
                is_active=True
            ).distinct().select_related('department', 'manager')
        else:
            team = User.objects.none()

        result = []
        for member in team:
            # Optionally skip self if requested, but generally useful to see self too
            status_data = StatusService.get_user_status(member)
            result.append({
                'user_id': str(member.id),
                'user_name': member.full_name,
                'email': member.email,
                'role': member.role,
                'department': member.department.name if member.department else None,
                'status': status_data['status'],
            })
        return Response(result)


class TeamTimesheetView(APIView):
    """
    Module 8 Extension: Manager-scoped team timesheet.
    Returns today's attendance records for all employees.
    If no attendance exists for an active employee, a dummy 'absent' record is generated.
    """
    permission_classes = [IsManager]

    def get(self, request):
        user = request.user
        
        # Managers and Admins should see all employees
        team = User.objects.filter(is_active=True, role='employee').select_related('department')

        # 2. Get today's actual attendance records for these employees
        today = date.today()
        # Optional: frontend could pass ?date=YYYY-MM-DD
        date_str = request.query_params.get('date')
        if date_str:
            try:
                from datetime import datetime
                today = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        attendances = Attendance.objects.filter(
            user__in=team,
            date=today
        ).select_related('user', 'reviewed_by').prefetch_related('work_sessions')
        
        # Map user ID to their attendance record
        att_map = {a.user_id: a for a in attendances}

        enriched = []
        for member in team:
            member_att = att_map.get(member.id)
            
            if member_att:
                # Use actual attendance data
                record = AttendanceSerializer(member_att).data
                record['user_name'] = member.full_name
                record['user_email'] = member.email
                if member.department:
                    record['department_name'] = member.department.name
                    
                # Calculate last logout time from work sessions
                last_logout = None
                sessions = member_att.work_sessions.all()
                if sessions:
                    # Get the end_time of the latest session
                    latest_session = max(sessions, key=lambda s: s.start_time)
                    if latest_session.end_time:
                        last_logout = latest_session.end_time.isoformat()
                record['last_logout'] = last_logout
            else:
                # Generate a dummy 'absent' record
                record = {
                    'id': f"dummy_{member.id}_{today}",
                    'user': member.id,
                    'user_name': member.full_name,
                    'user_email': member.email,
                    'department_name': member.department.name if member.department else None,
                    'date': str(today),
                    'status': 'absent',
                    'work_hours': '00:00:00',
                    'total_work_seconds': 0,
                    'total_break_seconds': 0,
                    'total_idle_seconds': 0,
                    'is_flagged': False,
                    'flag_reason': '',
                    'manager_remark': '',
                    'reviewed_by': None,
                    'reviewed_at': None,
                    'last_logout': None
                }

            # Annotate with live status (only makes sense for today, but we fetch it regardless)
            if today == date.today():
                status_data = StatusService.get_user_status(member)
                record['live_status'] = status_data['status']
            else:
                record['live_status'] = 'offline'

            enriched.append(record)

        return Response(enriched)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 10: LEAVE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'leave_type']
    search_fields = ['employee__email', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return LeaveRequest.objects.select_related('employee', 'reviewed_by').all()
        if user.role == 'manager':
            subordinate_ids = user.subordinates.values_list('id', flat=True)
            return LeaveRequest.objects.filter(
                Q(employee=user) | Q(employee__in=subordinate_ids)
            ).select_related('employee', 'reviewed_by')
        return LeaveRequest.objects.filter(employee=user).select_related('employee', 'reviewed_by')

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = date.today()
        # Fetch leaves overlapping with today
        qs = self.get_queryset().filter(from_date__lte=today, to_date__gte=today)
        # Requirement: "employee and manager only leaves" 
        qs = qs.filter(employee__role__in=['employee', 'manager'])
        
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = LeaveApplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leave = LeaveService.apply_leave(request.user, serializer.validated_data, request)
        NotificationService.notify_managers_and_admins(
            request.user, "Leave Request", f"{request.user.full_name} applied for leave.", "leave"
        )
        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsManager])
    def review(self, request, pk=None):
        leave_request = self.get_object()
        if leave_request.status != LeaveRequest.STATUS_PENDING:
            return Response({'detail': 'Leave is already reviewed.'}, status=400)

        serializer = LeaveReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = LeaveService.review_leave(
            leave_request,
            request.user,
            serializer.validated_data['action'],
            serializer.validated_data.get('comment', ''),
            request,
        )
        return Response(LeaveRequestSerializer(updated).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        leave_request = self.get_object()
        if leave_request.employee != request.user:
            return Response({'detail': 'Forbidden.'}, status=403)
        if leave_request.status != LeaveRequest.STATUS_PENDING:
            return Response({'detail': 'Cannot cancel a reviewed leave.'}, status=400)
        leave_request.status = LeaveRequest.STATUS_CANCELLED
        leave_request.save()
        return Response(LeaveRequestSerializer(leave_request).data)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 11: HOLIDAY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdmin()]


# ═══════════════════════════════════════════════════════════════════════════════
# Module 12: MANAGER REVIEW
# (Handled via AttendanceViewSet.review action above)
# ═══════════════════════════════════════════════════════════════════════════════

class FlaggedAttendanceView(generics.ListAPIView):
    """List all flagged attendance records for manager review."""
    serializer_class = AttendanceSerializer
    permission_classes = [IsManager]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['date', 'status']
    ordering = ['-date']

    def get_queryset(self):
        user = self.request.user
        qs = Attendance.objects.filter(is_flagged=True).select_related('user', 'reviewed_by')
        if user.role == 'manager':
            subordinate_ids = user.subordinates.values_list('id', flat=True)
            qs = qs.filter(user__in=subordinate_ids)
        return qs


# ═══════════════════════════════════════════════════════════════════════════════
# Module 13: POLICY CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

class AttendancePolicyViewSet(viewsets.ModelViewSet):
    queryset = AttendancePolicy.objects.all()
    serializer_class = AttendancePolicySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()] # Allow all authenticated to see policy, or at least Manager/Admin. We use IsAuthenticated since Employee might need it for info.
        return [IsAdmin()]

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditService.log(
            self.request.user, 'policy_change',
            f'Policy "{instance.name}" updated: min_hours={instance.min_working_hours}, idle_threshold={instance.idle_threshold_minutes}min',
            self.request
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Module 14: REPORTING
# ═══════════════════════════════════════════════════════════════════════════════

class ReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('type', 'summary')
        days = int(request.query_params.get('days', 7))
        user_id = request.query_params.get('user_id')

        # Determine whom to report on
        target_user = None
        if user_id and request.user.role in ('admin', 'manager'):
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found.'}, status=404)
        elif request.user.role == 'employee':
            target_user = request.user

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        if from_date:
            from datetime import datetime
            from_date = datetime.strptime(from_date, '%Y-%m-%d').date()
        if to_date:
            from datetime import datetime
            to_date = datetime.strptime(to_date, '%Y-%m-%d').date()

        if report_type == 'summary':
            data = ReportService.get_attendance_summary(target_user, from_date, to_date)
        elif report_type == 'daily':
            data = ReportService.get_daily_data(target_user, days)
        elif report_type == 'team' and request.user.role in ('admin', 'manager'):
            user = request.user
            if user.role == 'manager':
                subordinate_ids = list(user.subordinates.values_list('id', flat=True))
            else:
                subordinate_ids = list(User.objects.values_list('id', flat=True))
            data = []
            for uid in subordinate_ids:
                try:
                    member = User.objects.get(id=uid)
                    summary = ReportService.get_attendance_summary(member, from_date, to_date)
                    summary['user_id'] = str(uid)
                    summary['user_name'] = member.full_name
                    data.append(summary)
                except User.DoesNotExist:
                    pass
        else:
            return Response({'detail': 'Invalid report type.'}, status=400)

        return Response(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 15: AUDIT LOGS
# ═══════════════════════════════════════════════════════════════════════════════

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        'timestamp': ['exact', 'date', 'gte', 'lte'],
        'action_type': ['exact'],
        'user': ['exact']
    }
    search_fields = ['description', 'user__email']
    ordering = ['-timestamp']

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user').all()
        if getattr(self.request.user, 'role', '') == 'admin':
            return qs
        return qs.filter(user=self.request.user)


# ═══════════════════════════════════════════════════════════════════════════════
# Module 16: EXPORT
# ═══════════════════════════════════════════════════════════════════════════════

class ExportView(APIView):
    permission_classes = [IsManager] # Admin/Manager can export

    def get(self, request):
        print("EXPORT VIEW HIT!!!")
        export_type = request.query_params.get('type', 'attendance')
        file_format = request.query_params.get('export_format', 'csv')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        AuditService.log(request.user, 'export', f'Exported {export_type} as {file_format}', request)

        if export_type == 'attendance':
            return self._export_attendance(request, from_date, to_date, file_format)
        elif export_type == 'leave':
            return self._export_leave(request, from_date, to_date, file_format)
        elif export_type == 'audit':
            if request.user.role != 'admin':
                return Response({'detail': 'Admin only.'}, status=403)
            return self._export_audit(request, from_date, to_date, file_format)
        elif export_type == 'payroll':
            if request.user.role not in ['admin', 'manager']:
                return Response({'detail': 'Unauthorized.'}, status=403)
            return self._export_payroll(request, file_format)
        else:
            return Response({'detail': 'Invalid export type.'}, status=400)

    def _export_attendance(self, request, from_date, to_date, file_format):
        from django.http import HttpResponse
        qs = Attendance.objects.select_related('user', 'user__department').all()
        if request.user.role == 'manager':
            subordinate_ids = request.user.subordinates.values_list('id', flat=True)
            qs = qs.filter(user__in=subordinate_ids)
        if from_date:
            qs = qs.filter(date__gte=from_date)
        if to_date:
            qs = qs.filter(date__lte=to_date)

        if file_format == 'xlsx':
            return self._to_xlsx(
                qs,
                ['Employee', 'Email', 'Department', 'Date', 'Status',
                 'Work Hours', 'Break Hours', 'Idle Hours', 'Productive Hours', 'Flagged'],
                lambda a: [
                    a.user.full_name, a.user.email,
                    a.user.department.name if a.user.department else '',
                    str(a.date), a.status,
                    round(a.total_work_seconds / 3600, 2),
                    round(a.total_break_seconds / 3600, 2),
                    round(a.total_idle_seconds / 3600, 2),
                    round(a.effective_work_seconds / 3600, 2),
                    'Yes' if a.is_flagged else 'No',
                ],
                'attendance_export.xlsx'
            )

        # CSV
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance_export.csv"'
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Email', 'Department', 'Date', 'Status',
                         'Work Hours', 'Break Hours', 'Idle Hours', 'Productive Hours', 'Flagged'])
        for a in qs:
            writer.writerow([
                a.user.full_name, a.user.email,
                a.user.department.name if a.user.department else '',
                str(a.date), a.status,
                round(a.total_work_seconds / 3600, 2),
                round(a.total_break_seconds / 3600, 2),
                round(a.total_idle_seconds / 3600, 2),
                round(a.effective_work_seconds / 3600, 2),
                'Yes' if a.is_flagged else 'No',
            ])
        return response

    def _export_leave(self, request, from_date, to_date, file_format):
        from django.http import HttpResponse
        qs = LeaveRequest.objects.select_related('employee', 'reviewed_by').all()
        
        category = request.query_params.get('category')
        user_id = request.query_params.get('user_id')

        if request.user.role == 'manager':
            subordinate_ids = request.user.subordinates.values_list('id', flat=True)
            qs = qs.filter(employee__in=subordinate_ids)

        if category == 'employees':
            qs = qs.filter(employee__role='employee')
        elif category == 'managers':
            qs = qs.filter(employee__role='manager')
        elif category == 'particular_employee' and user_id:
            qs = qs.filter(employee_id=user_id)
            
        if from_date:
            qs = qs.filter(to_date__gte=from_date) # Leaves ending on or after from_date
        if to_date:
            qs = qs.filter(from_date__lte=to_date) # Leaves starting on or before to_date

        if file_format == 'xlsx':
            return self._to_xlsx(
                qs,
                ['Employee', 'Email', 'Type', 'From', 'To', 'Days', 'Status', 'Reason', 'Reviewed By'],
                lambda l: [
                    l.employee.full_name, l.employee.email,
                    l.leave_type, str(l.from_date), str(l.to_date),
                    l.duration_days, l.status, l.reason,
                    l.reviewed_by.full_name if l.reviewed_by else '',
                ],
                'leave_export.xlsx'
            )

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="leave_export.csv"'
        writer = csv.writer(response)
        writer.writerow(['Employee', 'Email', 'Type', 'From', 'To', 'Days', 'Status', 'Reason', 'Reviewed By'])
        for l in qs:
            writer.writerow([
                l.employee.full_name, l.employee.email,
                l.leave_type, str(l.from_date), str(l.to_date),
                l.duration_days, l.status, l.reason,
                l.reviewed_by.full_name if l.reviewed_by else '',
            ])
        return response

    def _export_audit(self, request, from_date, to_date, file_format):
        import csv
        from django.http import HttpResponse
        qs = AuditLog.objects.select_related('user').all()

        category = request.query_params.get('category')
        user_id = request.query_params.get('user_id')

        if category == 'employees':
            qs = qs.filter(user__role='employee')
        elif category == 'managers':
            qs = qs.filter(user__role='manager')
        elif category == 'particular_employee' and user_id:
            qs = qs.filter(user_id=user_id)
            
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)

        if file_format == 'xlsx':
            return self._to_xlsx(
                qs,
                ['User', 'Action', 'Description', 'IP', 'Timestamp'],
                lambda al: [
                    al.user.email if al.user else '',
                    al.action_type, al.description,
                    al.ip_address or '', str(al.timestamp),
                ],
                'audit_export.xlsx'
            )

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_export.csv"'
        writer = csv.writer(response)
        writer.writerow(['User', 'Action', 'Description', 'IP', 'Timestamp'])
        for al in qs:
            writer.writerow([
                al.user.email if al.user else '',
                al.action_type, al.description,
                al.ip_address or '', str(al.timestamp),
            ])
        return response

    def _export_payroll(self, request, file_format):
        from .services import PayrollPrepService
        from django.http import HttpResponse
        
        # Default to current month if not provided
        from datetime import date
        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year = int(request.query_params.get('year', today.year))
        
        payroll_data = PayrollPrepService.prepare_monthly_payroll(month, year)
        
        if file_format == 'xlsx':
            return self._to_xlsx(
                payroll_data,
                ['Employee ID', 'Email', 'Name', 'Department', 'Role', 'Payable Days', 'Present Days', 'Paid Leave Days', 'Reimbursable Expenses'],
                lambda p: [
                    p['employee_id'], p['email'], p['name'], p['department'],
                    p['role'], p['payable_days'], p['present_days'],
                    p['paid_leave_days'], p['reimbursable_expenses']
                ],
                f'payroll_{year}_{month:02d}.xlsx'
            )
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="payroll_{year}_{month:02d}.csv"'
        writer = csv.writer(response)
        writer.writerow(['Employee ID', 'Email', 'Name', 'Department', 'Role', 'Payable Days', 'Present Days', 'Paid Leave Days', 'Reimbursable Expenses'])
        for p in payroll_data:
            writer.writerow([
                p['employee_id'], p['email'], p['name'], p['department'],
                p['role'], p['payable_days'], p['present_days'],
                p['paid_leave_days'], p['reimbursable_expenses']
            ])
        return response

    def _to_xlsx(self, queryset, headers, row_fn, filename):
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from django.http import HttpResponse

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'REMS Export'

        # Header styling
        header_fill = PatternFill(start_color='1E3A5F', end_color='1E3A5F', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True)
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')

        for row_num, obj in enumerate(queryset, 2):
            for col, value in enumerate(row_fn(obj), 1):
                ws.cell(row=row_num, column=col, value=value)

        # Auto-width
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 10 Expanded Viewsets
# ═══════════════════════════════════════════════════════════════════════════════

from .models import IPWhitelist, Shift, Project, Task, AppUsageLog, Alert, Document, Expense
from .serializers import (
    IPWhitelistSerializer, ShiftSerializer, ProjectSerializer, TaskSerializer,
    AppUsageLogSerializer, AlertSerializer, DocumentSerializer, ExpenseSerializer
)

class IPWhitelistViewSet(viewsets.ModelViewSet):
    queryset = IPWhitelist.objects.all()
    serializer_class = IPWhitelistSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'project', 'assigned_to']
    search_fields = ['title', 'description']

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Task.objects.all()
        elif user.role == "manager":
            return Task.objects.all()
        return Task.objects.filter(assigned_to=user)

class AppUsageLogViewSet(viewsets.ModelViewSet):
    serializer_class = AppUsageLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        'timestamp': ['exact', 'date', 'gte', 'lte']
    }
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "manager"]:
            return AppUsageLog.objects.all()
        return AppUsageLog.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AlertViewSet(viewsets.ModelViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Alert.objects.filter(user=self.request.user)

class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "manager"]:
            return Document.objects.all()
        from django.db.models import Q
        return Document.objects.filter(Q(uploaded_by=user) | Q(is_public=True))

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "manager"]:
            return Expense.objects.all()
        return Expense.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ═══════════════════════════════════════════════════════════════════════════════
# Notifications API
# ═══════════════════════════════════════════════════════════════════════════════
from rest_framework.decorators import action

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_read', 'type']
    ordering = ['-created_at']

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'All notifications marked as read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'Notification marked as read'})
