"""
Business logic service layer for REMS.
All complex logic lives here; views remain thin.
"""

from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
from datetime import date, timedelta
from django.core.cache import cache
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Extract the real client IP from request headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_device_info(request):
    """Capture basic device fingerprint from User-Agent."""
    return request.META.get('HTTP_USER_AGENT', 'Unknown Device')[:500]


# ── Notification Engine ────────────────────────────────────────────────────────
class NotificationService:
    @staticmethod
    def _send_notifications(sender, recipients_qs, title, message, notif_type):
        """Internal helper: bulk-create notifications and broadcast over WebSocket."""
        from .models import Notification
        notifications = [
            Notification(
                recipient=recipient,
                sender=sender,
                type=notif_type,
                title=title,
                message=message
            )
            for recipient in recipients_qs
        ]
        if not notifications:
            return
        created = Notification.objects.bulk_create(notifications)
        channel_layer = get_channel_layer()
        sender_name = sender.full_name if sender else "System"
        
        for notif in created:
            async_to_sync(channel_layer.group_send)(
                'status_updates',
                {
                    'type': 'notification_alert',
                    'notification_id': str(notif.id),
                    'recipient_id': str(notif.recipient.id),
                    'title': notif.title,
                    'message': notif.message,
                    'notif_type': notif.type,
                    'sender_name': sender_name
                }
            )

    @staticmethod
    def notify_managers_and_admins(sender, title, message, notif_type='system'):
        """Legacy helper – kept for leave/task notifications. Notifies managers + admins."""
        from .models import User
        recipients = User.objects.filter(role__in=['admin', 'manager']).exclude(id=sender.id).distinct()
        NotificationService._send_notifications(sender, recipients, title, message, notif_type)

    @staticmethod
    def notify_all_active_users(sender, title, message, notif_type='system'):
        """Broadcast a notification to all active users in the system."""
        from .models import User
        recipients = User.objects.filter(is_active=True).exclude(id=sender.id).distinct()
        NotificationService._send_notifications(sender, recipients, title, message, notif_type)

    @staticmethod
    def notify_based_on_role(user, title, message, notif_type='system'):
        """
        Notify appropriate superiors based on the user's role:
        - Employee -> Manager & Admins
        - Manager -> Admins
        """
        from .models import User
        if user.role == 'employee':
            recipients = User.objects.filter(
                Q(id=user.manager_id) | Q(role='admin')
            ).exclude(id__isnull=True).distinct()
        elif user.role == 'manager':
            recipients = User.objects.filter(role='admin').distinct()
        else:
            recipients = User.objects.none()
            
        if recipients.exists():
            NotificationService._send_notifications(user, recipients, title, message, notif_type)

    @staticmethod
    def notify_shift_event(user, title, message, notif_type='status'):
        """
        Notify Employee, their Manager, and all Admins about a shift-related event.
        """
        from .models import User
        recipients = User.objects.filter(
            Q(id=user.id) |  # Employee
            Q(id=user.manager_id) |  # Manager
            Q(role='admin')  # Admins
        ).distinct()
        
        # If no sender is provided, use the user themselves as the logical 'source' of the event
        NotificationService._send_notifications(user, recipients, title, message, notif_type)

    @staticmethod
    def notify_attendance_override(admin_user, employee, date_str, new_status):
        """
        Notify Employee and their Manager about an attendance status override.
        """
        from .models import User
        recipients = User.objects.filter(
            Q(id=employee.id) | 
            Q(id=employee.manager_id)
        ).distinct()
        
        title = "Attendance Status Updated"
        message = f"Admin {admin_user.full_name} has updated the attendance status for {employee.full_name} on {date_str} to '{new_status}'."
        
        NotificationService._send_notifications(admin_user, recipients, title, message, 'system')

# ── Attendance Engine ──────────────────────────────────────────────────────────

class AttendanceService:
    """Core attendance engine. Status derived solely from time calculations."""

    @staticmethod
    @transaction.atomic
    def get_or_create_today(user):
        """Called on login. Creates attendance record for today if not exists."""
        from .models import Attendance, Holiday

        today = date.today()

        # Check if today is a holiday
        holiday = Holiday.objects.filter(date=today).first()
        if holiday:
            default_status = Attendance.STATUS_HOLIDAY
            default_remark = f"Holiday: {holiday.name}"
        else:
            default_status = Attendance.STATUS_ABSENT
            default_remark = ""

        attendance, created = Attendance.objects.get_or_create(
            user=user,
            date=today,
            defaults={
                'status': default_status,
                'manager_remark': default_remark
            }
        )
        return attendance, created

    @staticmethod
    @transaction.atomic
    def recalculate_status(attendance):
        """
        Recalculate total work/break/idle seconds and set status.
        Status is NEVER manually set – always derived from time data.
        """
        from django.utils import timezone
        from .models import AttendancePolicy
        now = timezone.now()
        
        # 1. Get policy and shift end for boundary enforcement
        try:
            policy = AttendancePolicy.objects.filter(is_active=True).first()
            present_hours = float(policy.present_hours) if policy else 8.0
            min_hours = float(policy.min_working_hours) if policy else 8.0
            half_day_hours = float(policy.half_day_hours) if policy else 4.0
            idle_threshold_minutes = policy.idle_threshold_minutes if policy else 15
        except Exception:
            policy = None
            present_hours = 8.0
            min_hours = 8.0
            half_day_hours = 4.0
            idle_threshold_minutes = 15

        import datetime
        now_local = timezone.localtime(now)
        shift_end_dt = now_local # default
        if policy:
           shift_end_dt = timezone.make_aware(datetime.datetime.combine(now_local.date(), policy.shift_end_time))
        
        # Enforce shift boundary for calculations: if shift ended, cap 'now' at shift_end_dt
        calculation_now = now
        if now_local > shift_end_dt:
            calculation_now = shift_end_dt

        # 2. Total work session seconds (closed + active)
        work_sessions = attendance.work_sessions.all()
        total_work = 0
        for ws in work_sessions:
            ws_end = ws.end_time if ws.end_time else calculation_now
            # Cap ws_end at calculation_now even if manually stopped late
            ws_end = min(ws_end, calculation_now)
            
            if ws_end > ws.start_time:
                total_work += int((ws_end - ws.start_time).total_seconds())

        # 3. Total break seconds
        total_break = 0
        for ws in work_sessions:
            for bs in ws.break_sessions.all():
                bs_end = bs.end_time if bs.end_time else calculation_now
                bs_end = min(bs_end, calculation_now)
                
                if bs_end > bs.start_time:
                    total_break += int((bs_end - bs.start_time).total_seconds())

        # 4. Total idle seconds
        total_idle = 0
        for ws in work_sessions:
            for il in ws.idle_logs.all():
                il_end = il.end_time if il.end_time else calculation_now
                il_end = min(il_end, calculation_now)
                
                if il_end > il.start_time:
                    total_idle += int((il_end - il.start_time).total_seconds())

        # 5. Status calculation based on effective work hours (work - break - idle)
        effective_work_seconds = max(0, total_work - total_break - total_idle)
        total_work_hours = effective_work_seconds / 3600

        # Determine status
        auto_remark = ""
        
        # Shift End Check
        import datetime
        now_local = timezone.localtime(now)
        shift_end_dt = now_local # default
        if policy:
           shift_end_dt = timezone.make_aware(datetime.datetime.combine(now_local.date(), policy.shift_end_time))
        
        is_shift_over = now_local >= shift_end_dt
        has_open_session = attendance.work_sessions.filter(end_time__isnull=True).exists()

        if attendance.status in (
            attendance.STATUS_ON_LEAVE,
            attendance.STATUS_HOLIDAY,
        ):
            status = attendance.status  # don't override leave/holiday
        elif total_work_hours >= present_hours:
            status = attendance.STATUS_PRESENT
            auto_remark = ""
        elif total_work_hours >= min_hours:
            status = attendance.STATUS_PRESENT
            auto_remark = ""
        elif has_open_session and not is_shift_over:
            # Still working and shift hasn't ended: Keep as calculating/optimistic
            status = attendance.STATUS_PRESENT
            auto_remark = ""
        elif total_work_hours >= half_day_hours:
            status = attendance.STATUS_HALF_DAY
            auto_remark = f"Hours ({total_work_hours:.2f}h) below required {min_hours}h for Present status."
        elif effective_work_seconds > 0:
            status = attendance.STATUS_HALF_DAY if total_work_hours > 0 else attendance.STATUS_ABSENT
            auto_remark = f"Hours ({total_work_hours:.2f}h) below threshold for Half Day."
        else:
            status = attendance.STATUS_ABSENT
            auto_remark = "No work hours recorded."

        # Check if exceeds idle threshold (flag anomalies)
        idle_percentage = (total_idle / total_work * 100) if total_work > 0 else 0
        should_flag_idle = idle_percentage > 30

        attendance.total_work_seconds = effective_work_seconds
        attendance.total_break_seconds = total_break
        attendance.total_idle_seconds = total_idle
        
        # Override status
        attendance.status = status

        # Only set automated remark if manager hasn't provided one
        # AND only if the shift is over or session closed (to avoid premature "Below hours" notes)
        if not attendance.manager_remark or any(text in (attendance.manager_remark or "") for text in ["Hours", "No work"]):
            if is_shift_over or not has_open_session:
                attendance.manager_remark = auto_remark
            else:
                attendance.manager_remark = "" # Clear automated warnings while still working

        # Dynamic Flagging - only if shift is over or session closed
        if should_flag_idle and (is_shift_over or not has_open_session):
            attendance.is_flagged = True
            attendance.flag_reason = f'High idle time: {idle_percentage:.1f}% of work time'
        elif not should_flag_idle or (not is_shift_over and has_open_session):
            # Clear or don't set flag if still working or idle is fine
            if attendance.is_flagged and any(text in (attendance.flag_reason or '') for text in ['High idle', 'Hours']):
                attendance.is_flagged = False
                attendance.flag_reason = ''
        
        attendance.save(update_fields=[
            'total_work_seconds', 'total_break_seconds', 'total_idle_seconds',
            'status', 'is_flagged', 'flag_reason', 'manager_remark', 'updated_at'
        ])
        return attendance

    @staticmethod
    @transaction.atomic
    def auto_checkout_all_active_sessions():
        """
        Find all open work sessions for today that have passed the shift end time.
        Close them and notify all roles.
        """
        from .models import WorkSession, AttendancePolicy
        import datetime
        
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if not policy:
            return 0
            
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        
        # Combine date and time for comparison
        shift_end_dt = timezone.make_aware(datetime.datetime.combine(today, policy.shift_end_time))
        
        if now_local < shift_end_dt:
            return 0 # Shift hasn't ended yet
            
        open_sessions = WorkSession.objects.filter(
            end_time__isnull=True,
            attendance__date=today
        ).select_related('attendance__user')
        
        count = 0
        for session in open_sessions:
            # Close session at exactly shift_end_time if it started before that
            close_time = shift_end_dt
            WorkSessionService.stop_session(session.attendance.user, end_time=close_time, is_auto=True)
            count += 1
            
        return count

    @staticmethod
    def notify_upcoming_shifts():
        """
        Notify employees, managers, and admins 5 minutes before shifts start.
        """
        from .models import User, AttendancePolicy
        from django.core.cache import cache
        import datetime
        
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        
        # Target time is exactly 5 minutes from now
        target_time = (now_local + datetime.timedelta(minutes=5)).replace(second=0, microsecond=0)
        target_time_str = target_time.strftime("%H:%M")
        
        # Check all active policies
        policies = AttendancePolicy.objects.filter(is_active=True)
        
        total_notifications = 0
        system_sender = User.objects.filter(role='admin', is_active=True).first()
        admins = User.objects.filter(role='admin', is_active=True).distinct()

        for policy in policies:
            # Match shift start time
            if policy.shift_start_time.strftime("%H:%M") == target_time_str:
                # Cache key to prevent duplicate runs within the same minute
                cache_key = f"shift_notif_{policy.id}_{today}_{target_time_str}"
                if cache.get(cache_key):
                    continue
                
                # Get employees under this policy
                users = User.objects.filter(is_active=True, role='employee')
                if policy.department:
                    users = users.filter(department=policy.department)
                
                if not users.exists():
                    continue

                affected_employees = list(users)
                employee_names = ", ".join([e.full_name for e in affected_employees[:5]])
                if len(affected_employees) > 5:
                    employee_names += f" and {len(affected_employees) - 5} others"

                # 1. Notify Employees (Individual)
                for employee in affected_employees:
                    NotificationService._send_notifications(
                        system_sender, [employee],
                        "Shift Starting Soon",
                        f"Reminder: Your shift starts in 5 minutes at {policy.shift_start_time.strftime('%I:%M %p')}.",
                        "system"
                    )
                    total_notifications += 1
                
                # 2. Notify Managers (Grouped)
                managers = User.objects.filter(
                    id__in=users.values_list('manager_id', flat=True)
                ).distinct()
                
                for manager in managers:
                    manager_employees = [e for e in affected_employees if e.manager_id == manager.id]
                    if manager_employees:
                        emp_list = ", ".join([e.full_name for e in manager_employees[:3]])
                        if len(manager_employees) > 3:
                            emp_list += f" and {len(manager_employees) - 3} others"
                        
                        NotificationService._send_notifications(
                            system_sender, [manager],
                            "Upcoming Team Shift",
                            f"Shift starting in 5 minutes for: {emp_list}.",
                            "system"
                        )
                        total_notifications += 1

                # 3. Notify Admins (System-wide)
                dept_info = f" in {policy.department.name}" if policy.department else ""
                NotificationService._send_notifications(
                    system_sender, admins,
                    "Upcoming Shifts Alert",
                    f"{len(affected_employees)} employees starting shifts{dept_info} in 5 minutes: {employee_names}.",
                    "system"
                )
                total_notifications += len(admins)

                # Mark as sent
                cache.set(cache_key, True, timeout=120)

        return total_notifications


# ── Work Session Service ───────────────────────────────────────────────────────

class WorkSessionService:

    @staticmethod
    @transaction.atomic
    def start_session(user, request):
        """Start a new work session for the user. Create attendance if needed."""
        from .models import WorkSession, Attendance, AttendancePolicy
        import datetime

        policy = AttendancePolicy.objects.filter(is_active=True).first()
        now_local = timezone.localtime(timezone.now())
        
        # 1. Enforce shift start time constraint
        if policy:
            if now_local.time() < policy.shift_start_time:
                raise ValueError(f"Shift has not started yet. You can start work after {policy.shift_start_time.strftime('%I:%M %p')}.")

        attendance, _ = AttendanceService.get_or_create_today(user)
        # Sequence lock on parent attendance to prevent double-click creation races
        Attendance.objects.select_for_update().get(id=attendance.id)

        # 2. Enforce one-session-per-day constraint (disable after checkout)
        completed_sessions = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=False
        ).exists()
        if completed_sessions:
            raise ValueError("You have already checked out for today. New sessions are restricted until tomorrow.")

        # Check if there's already an open session
        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()
        if open_session:
            return open_session, False  # already running

        session = WorkSession.objects.create(
            attendance=attendance,
            start_time=timezone.now(),
            ip_address=get_client_ip(request),
            device_info=get_device_info(request),
        )
        AuditService.log(user, 'create', 'Work session started', request)
        StatusService.broadcast_status_change(user)
        time_str = timezone.localtime(timezone.now()).strftime("%I:%M %p")
        NotificationService.notify_shift_event(
            user, "Shift Started", f"{user.full_name} started their shift at {time_str}."
        )
        return session, True

    @staticmethod
    @transaction.atomic
    def stop_session(user, end_time=None, is_auto=False):
        """Stop the active work session and recalculate status."""
        from .models import WorkSession, Attendance

        attendance, _ = AttendanceService.get_or_create_today(user)
        # Sequence lock on parent attendance to prevent double-click creation races
        Attendance.objects.select_for_update().get(id=attendance.id)

        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()

        if not open_session:
            return None, False

        # Capping Logic: If not admin, cap end_time to shift_end_time if it has passed
        stop_time = end_time if end_time else timezone.now()
        
        if user.role != 'admin':
            from .models import AttendancePolicy
            import datetime
            policy = AttendancePolicy.objects.filter(is_active=True).first()
            if policy:
                now_local = timezone.localtime(stop_time)
                shift_end_dt = timezone.make_aware(datetime.datetime.combine(now_local.date(), policy.shift_end_time))
                if now_local > shift_end_dt:
                    stop_time = shift_end_dt
                    is_auto = True # Mark as auto if we capped it

        # Also close any open break
        open_break = open_session.break_sessions.filter(end_time__isnull=True).first()
        if open_break:
            open_break.end_time = stop_time
            open_break.save(update_fields=['end_time', 'updated_at'])

        # Close any open idle log
        open_idle = open_session.idle_logs.filter(end_time__isnull=True).first()
        if open_idle:
            open_idle.end_time = stop_time
            open_idle.save(update_fields=['end_time', 'updated_at'])

        open_session.end_time = stop_time
        open_session.save(update_fields=['end_time', 'updated_at'])

        AttendanceService.recalculate_status(attendance)
        StatusService.broadcast_status_change(user)
        
        time_str = timezone.localtime(stop_time).strftime("%I:%M %p")
        msg_suffix = " (Auto-Checkout)" if is_auto else ""
        NotificationService.notify_shift_event(
            user, 
            "Shift Ended" + msg_suffix, 
            f"{user.full_name} clocked out at {time_str}{msg_suffix}."
        )
        return open_session, True


# ── Break Session Service ──────────────────────────────────────────────────────

class BreakSessionService:

    @staticmethod
    @transaction.atomic
    def start_break(user):
        """Start a break within the active work session."""
        from .models import WorkSession, BreakSession, Attendance

        attendance, _ = AttendanceService.get_or_create_today(user)
        # Sequence lock on parent attendance to prevent double-click creation races
        Attendance.objects.select_for_update().get(id=attendance.id)

        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()

        if not open_session:
            raise ValueError('No active work session. Start work first.')

        # Check no break already running
        existing_break = open_session.break_sessions.filter(end_time__isnull=True).first()
        if existing_break:
            return existing_break, False

        # Close any open idle log before starting break
        open_idle = open_session.idle_logs.filter(end_time__isnull=True).first()
        if open_idle:
            open_idle.end_time = timezone.now()
            open_idle.save(update_fields=['end_time', 'updated_at'])

        break_session = BreakSession.objects.create(
            work_session=open_session,
            start_time=timezone.now(),
        )
        StatusService.broadcast_status_change(user)
        NotificationService.notify_based_on_role(
            user, "On Break", f"{user.full_name} started a break.", "status"
        )
        return break_session, True

    @staticmethod
    @transaction.atomic
    def stop_break(user):
        """End the active break."""
        from .models import WorkSession

        attendance, _ = AttendanceService.get_or_create_today(user)
        open_session = WorkSession.objects.select_for_update().filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()

        if not open_session:
            return None, False

        open_break = open_session.break_sessions.filter(end_time__isnull=True).first()
        if not open_break:
            return None, False

        open_break.end_time = timezone.now()
        open_break.save(update_fields=['end_time', 'updated_at'])
        AttendanceService.recalculate_status(attendance)
        StatusService.broadcast_status_change(user)
        NotificationService.notify_based_on_role(
            user, "Back from Break", f"{user.full_name} returned from break.", "status"
        )
        return open_break, True


# ── Idle Log Service ───────────────────────────────────────────────────────────

class IdleService:

    @staticmethod
    @transaction.atomic
    def start_idle(user):
        """Log idle start. Called by frontend after 15 min of inactivity."""
        from .models import WorkSession, IdleLog

        attendance, _ = AttendanceService.get_or_create_today(user)
        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()

        if not open_session:
            return None, False

        # Prevent idle during an active break
        on_break = open_session.break_sessions.filter(end_time__isnull=True).exists()
        if on_break:
            return None, False

        existing_idle = open_session.idle_logs.filter(end_time__isnull=True).first()
        if existing_idle:
            return existing_idle, False

        idle_log = IdleLog.objects.create(
            work_session=open_session,
            start_time=timezone.now(),
        )
        time_str = timezone.localtime(timezone.now()).strftime("%I:%M %p")
        # Notify Employee, Manager, and Admin
        NotificationService.notify_shift_event(
            user, "Idle Detected", f"{user.full_name} has been idle for 15+ minutes.", "system"
        )
        return idle_log, True

    @staticmethod
    @transaction.atomic
    def stop_idle(user):
        """Resume from idle. Called when user moves mouse/types."""
        from .models import WorkSession

        attendance, _ = AttendanceService.get_or_create_today(user)
        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()

        if not open_session:
            return None, False

        open_idle = open_session.idle_logs.filter(end_time__isnull=True).first()
        if not open_idle:
            return None, False

        open_idle.end_time = timezone.now()
        open_idle.save(update_fields=['end_time', 'updated_at'])
        AttendanceService.recalculate_status(attendance)
        StatusService.broadcast_status_change(user)
        
        # Notify Employee, Manager and Admin
        NotificationService.notify_shift_event(
            user, "Activity Resumed", f"{user.full_name} is active again.", "system"
        )
        return open_idle, True


# ── Real-Time Status Service ───────────────────────────────────────────────────

class StatusService:

    @staticmethod
    def broadcast_status_change(user):
        """Helper to push the current status of a user over Django Channels."""
        try:
            channel_layer = get_channel_layer()
            status_data = StatusService.get_user_status(user)
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    'status_updates',
                    {
                        'type': 'status_update',
                        'user_id': str(user.id),
                        'status': status_data['status']
                    }
                )
        except Exception as e:
            logger.error(f"WebSocket broadcast failed: {e}")

    @staticmethod
    def broadcast_policy_update():
        """Broadcast to all users that the attendance policy has changed."""
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    'status_updates',
                    {
                        'type': 'policy_update',
                        'message': 'Full policy refresh required'
                    }
                )
        except Exception as e:
            logger.error(f"Policy broadcast failed: {e}")

    @staticmethod
    def get_user_status(user):
        """
        Return real-time status: online/working/idle/on_break/offline
        """
        from .models import WorkSession

        if user.role == 'admin':
            return {'status': 'working', 'attendance': None, 'session': None}

        today = date.today()
        attendance = user.attendances.filter(date=today).first()
        if not attendance:
            status = 'online' if cache.get(f'presence_{user.id}') else 'offline'
            return {'status': status, 'attendance': None}

        # Ensure real-time accuracy for status displays
        AttendanceService.recalculate_status(attendance)
 
        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()
 
        if not open_session:
            status = 'online' if cache.get(f'presence_{user.id}') else 'offline'
            return {'status': status, 'attendance': attendance}

        # Check break (Prioritized over idle)
        open_break = open_session.break_sessions.filter(end_time__isnull=True).first()
        if open_break:
            return {'status': 'on_break', 'attendance': attendance, 'session': open_session}

        # Check idle
        open_idle = open_session.idle_logs.filter(end_time__isnull=True).first()
        if open_idle:
            return {'status': 'idle', 'attendance': attendance, 'session': open_session}

        return {'status': 'working', 'attendance': attendance, 'session': open_session}


# ── Leave Service ──────────────────────────────────────────────────────────────

class LeaveService:

    @staticmethod
    @transaction.atomic
    def apply_leave(employee, data, request):
        """Employee applies for leave."""
        from .models import LeaveRequest

        leave = LeaveRequest.objects.create(
            employee=employee,
            leave_type=data['leave_type'],
            from_date=data['from_date'],
            to_date=data['to_date'],
            reason=data['reason'],
        )
        AuditService.log(employee, 'create', f'Leave request submitted: {leave.leave_type}', request)
        return leave

    @staticmethod
    @transaction.atomic
    def review_leave(leave_request, reviewer, action, comment, request):
        """Manager/Admin approves or rejects leave."""
        from .models import Attendance, Holiday, LeaveRequest

        if action == 'approve':
            leave_request.status = LeaveRequest.STATUS_APPROVED
            # Mark attendance as on_leave for each date
            d = leave_request.from_date
            while d <= leave_request.to_date:
                is_holiday = Holiday.objects.filter(date=d).exists()
                if not is_holiday:
                    Attendance.objects.update_or_create(
                        user=leave_request.employee,
                        date=d,
                        defaults={
                            'status': Attendance.STATUS_ON_LEAVE,
                            'manager_remark': f"Leave: {leave_request.get_leave_type_display()} - {leave_request.reason or ''}"
                        }
                    )
                d += timedelta(days=1)
        elif action == 'reject':
            leave_request.status = LeaveRequest.STATUS_REJECTED
        else:
            raise ValueError(f'Unknown action: {action}')

        leave_request.reviewed_by = reviewer
        leave_request.review_comment = comment
        leave_request.reviewed_at = timezone.now()
        leave_request.save()

        AuditService.log(
            reviewer, action,
            f'Leave {action}d for {leave_request.employee.email}: {leave_request.id}',
            request
        )
        return leave_request


# ── Reporting Service ──────────────────────────────────────────────────────────

class ReportService:

    @staticmethod
    def get_attendance_summary(user_ids=None, from_date=None, to_date=None):
        """
        Return attendance summary stats.
        user_ids: Optional list of user IDs to filter by.
        """
        from .models import Attendance, AttendancePolicy
        from django.db.models import Sum
        from django.utils import timezone
        import datetime
        import pytz

        today = date.today()
        qs = Attendance.objects.all()
        if user_ids is not None:
            qs = qs.filter(user_id__in=user_ids)
        if from_date:
            qs = qs.filter(date__gte=from_date)
            
        # Cap range to today to avoid future leaves skewing averages
        range_end = to_date if to_date else today
        if isinstance(range_end, str):
            range_end = date.fromisoformat(range_end)
        
        effective_to_date = min(range_end, today)
        qs = qs.filter(date__lte=effective_to_date)

        # Get policy for cutoff check
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        shift_end = policy.shift_end_time if policy else datetime.time(17, 30)
        
        # Recalculate TODAY's records in the queryset to ensure real-time accuracy
        # This is CRITICAL for dashboards and reports to stay in sync with live activity
        from .services import AttendanceService
        today_records = qs.filter(date=today)
        for record in today_records:
            AttendanceService.recalculate_status(record)
        
        # IST check
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = timezone.now().astimezone(ist)
        is_before_cutoff = now_ist.time() < shift_end

        total = qs.count()
        present = qs.filter(status='present').count()
        half_day = qs.filter(status='half_day').count()
        on_leave = qs.filter(status='on_leave').count()
        
        # Absent logic: only count as absent if it's NOT today or if cutoff passed
        absent_qs = qs.filter(status='absent')
        if is_before_cutoff:
            # Exclude today's absents from the final "Absent" count if shift hasn't ended
            final_absent = absent_qs.exclude(date=today).count()
            calculating = absent_qs.filter(date=today).count()
        else:
            final_absent = absent_qs.count()
            calculating = 0

        absent = final_absent

        avg_work = qs.aggregate(avg=Sum('total_work_seconds'))['avg'] or 0
        avg_idle = qs.aggregate(avg=Sum('total_idle_seconds'))['avg'] or 0

        # Calculate Productivity Score (Average over the days/users)
        # Avoid iterating through thousands of records for global summaries (Admin overview)
        # only calculate if we have a manageable number of records (< 200) or specific user filters
        total_score = 0
        scored_days = 0
        
        if total < 200:
            for d_att in qs.select_related('user'):
                total_score += ProductivityScoringService.calculate_score(d_att.user, d_att.date)
                scored_days += 1
                
        avg_productivity_score = round(total_score / scored_days) if scored_days > 0 else 0

        return {
            'total': total,
            'present': present,
            'half_day': half_day,
            'absent': absent,
            'calculating': calculating,
            'on_leave': on_leave,
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 0,
            'avg_work_hours': round(avg_work / 3600, 2) if total > 0 else 0,
            'avg_idle_hours': round(avg_idle / 3600, 2) if total > 0 else 0,
            'productivity_score': avg_productivity_score,
        }

    @staticmethod
    def get_daily_data(user_ids=None, days=7):
        """
        Return per-day productivity data for charts.
        user_ids: Optional list of user IDs to filter by.
        """
        from .models import Attendance, User
        from django.db.models import Sum

        end = date.today()
        start = end - timedelta(days=days - 1)

        qs = Attendance.objects.filter(date__range=(start, end))
        if user_ids is not None:
            qs = qs.filter(user_id__in=user_ids)

        # Ensure today's data is recalculated for the trend chart
        from .services import AttendanceService
        today_records = qs.filter(date=end)
        for record in today_records:
            AttendanceService.recalculate_status(record)

        result = []
        d = start
        while d <= end:
            day_qs = qs.filter(date=d)
            work_s = day_qs.aggregate(s=Sum('total_work_seconds'))['s'] or 0
            idle_s = day_qs.aggregate(s=Sum('total_idle_seconds'))['s'] or 0
            break_s = day_qs.aggregate(s=Sum('total_break_seconds'))['s'] or 0

            # Performance safety cap: skip scores for massive datasets
            total_day_score = 0
            scored_count = 0
            if qs.count() < 500:
                from .services import ProductivityScoringService
                for att in day_qs.select_related('user'):
                    total_day_score += ProductivityScoringService.calculate_score(att.user, d)
                    scored_count += 1
            daily_score = round(total_day_score / scored_count) if scored_count > 0 else 0

            result.append({
                'date': d.strftime('%Y-%m-%d'),
                'work_hours': round(work_s / 3600, 2),
                'idle_hours': round(idle_s / 3600, 2),
                'break_hours': round(break_s / 3600, 2),
                'productive_hours': round(work_s / 3600, 2),
                'productivity_score': daily_score,
                'present': day_qs.filter(status='present').count(),
                'absent': day_qs.filter(status='absent').count(),
            })
            d += timedelta(days=1)
        return result


# ── Audit Service ──────────────────────────────────────────────────────────────

class AuditService:

    @staticmethod
    def log(user, action_type, description, request=None, extra_data=None):
        """Create an audit log entry."""
        from .models import AuditLog
        try:
            AuditLog.objects.create(
                user=user,
                action_type=action_type,
                description=description,
                ip_address=get_client_ip(request) if request else None,
                user_agent=get_device_info(request) if request else '',
                extra_data=extra_data or {},
            )
        except Exception as e:
            logger.error(f'AuditLog creation failed: {e}')

# ── Productivity & Payroll Services (Phase 10) ─────────────────────────────────

class ProductivityScoringService:
    @staticmethod
    def calculate_score(user, target_date=None):
        """
        Calculates a daily productivity score (0-100) based on:
        - Total work hours (vs policy minimum)
        - Subtracting excessive idle time
        - Penalty for flagged anomalous behavior (too many breaks, unauthorized apps)
        """
        from .models import Attendance, AttendancePolicy, AppUsageLog

        if not target_date:
            target_date = date.today()

        attendance = Attendance.objects.filter(user=user, date=target_date).first()
        if not attendance:
            return 0  # No attendance = 0 score

        # Ensure live data is used for today's score calculation
        if target_date == date.today():
            from .services import AttendanceService
            AttendanceService.recalculate_status(attendance)

        # Base score from work hours
        try:
            policy = AttendancePolicy.objects.filter(is_active=True).first()
            min_hours = float(policy.min_working_hours) * 3600 if policy else 8 * 3600
        except Exception:
            min_hours = 8 * 3600

        work_sec = attendance.total_work_seconds
        idle_sec = attendance.total_idle_seconds
        break_sec = attendance.total_break_seconds
        
        # Base proportion of minimum hours (using total work hours as requested)
        score = (work_sec / min_hours) * 100 if min_hours > 0 else 0

        # Penalties: High idle/breaks
        if attendance.is_flagged:
            score -= 15  # Flat penalty for anomalies

        # Penalties: Unauthorized Web/App usage (simulated based on app logs)
        # Assuming app logs > 1 hour of non-work apps penalizes
        non_work_apps_sec = AppUsageLog.objects.filter(
            user=user, 
            timestamp__date=target_date
        ).aggregate(s=Sum('duration_seconds'))['s'] or 0
        if non_work_apps_sec > 3600:
            score -= 10

        return max(0, min(100, round(score)))


class PayrollPrepService:
    @staticmethod
    def prepare_monthly_payroll(month: int, year: int):
        """
        Aggregate attendance, leaves, and expenses for payroll generation.
        Returns a list of dicts suitable for CSV export via the ExportView.
        """
        from .models import User, Attendance, LeaveRequest, Expense

        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)

        payroll_data = []
        users = User.objects.filter(is_active=True)
        today = date.today()

        for user in users:
            user_qs = Attendance.objects.filter(user=user, date__range=(start_date, end_date))
            
            # Recalculate today's record if it falls within the payroll period
            if start_date <= today <= end_date:
                today_att = user_qs.filter(date=today).first()
                if today_att:
                    from .services import AttendanceService
                    AttendanceService.recalculate_status(today_att)

            # 1. Total Days Worked
            present_days = user_qs.filter(
                status__in=[Attendance.STATUS_PRESENT, Attendance.STATUS_HALF_DAY]
            ).count()

            # 2. Approved Paid Leaves (Assuming all approved leaves are paid for simple calculation)
            approved_leaves = LeaveRequest.objects.filter(
                employee=user,
                status=LeaveRequest.STATUS_APPROVED,
                from_date__lte=end_date,
                to_date__gte=start_date
            )
            leave_days = sum(l.duration_days for l in approved_leaves)

            # 3. Approved Expenses for Reimbursement
            approved_expenses = Expense.objects.filter(
                user=user,
                status=Expense.STATUS_APPROVED,
                created_at__date__range=[start_date, end_date]
            ).aggregate(amount=Sum('amount'))['amount'] or 0.0

            payroll_data.append({
                'employee_id': str(user.id),
                'email': user.email,
                'name': user.full_name,
                'department': user.department.name if user.department else 'N/A',
                'role': user.role,
                'payable_days': present_days + leave_days,
                'present_days': present_days,
                'paid_leave_days': leave_days,
                'reimbursable_expenses': float(approved_expenses)
            })

        return payroll_data
