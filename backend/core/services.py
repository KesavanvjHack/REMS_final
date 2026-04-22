"""
Business logic service layer for REMS.
All complex logic lives here; views remain thin.
"""

import os
from datetime import date, datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
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
        try:
            created = Notification.objects.bulk_create(notifications)
            channel_layer = get_channel_layer()
            if channel_layer:
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
                            'sender_name': sender.full_name
                        }
                    )
        except Exception as e:
            logger.error(f"Notification processing failed: {e}")

    @staticmethod
    def notify_based_on_role(user, title, message, notif_type='system', sender=None):
        """
        Notify appropriate superiors based on the user's role:
        - Employee -> Manager & Admins
        - Manager -> Admins
        Args:
            user: The user whose superiors should be notified.
            title: notification title
            message: notification message
            notif_type: 'system', 'status', etc.
            sender: The user who triggered the notification (defaults to 'user' if not provided).
        """
        from .models import User
        if sender is None:
            sender = user

        if user.role == 'employee':
            recipients = User.objects.filter(
                Q(id=user.manager_id) | Q(role='admin')
            ).exclude(id=sender.id).distinct()
        elif user.role == 'manager':
            recipients = User.objects.filter(role='admin').exclude(id=sender.id).distinct()
        else:
            recipients = User.objects.none()
            
        if recipients.exists():
            NotificationService._send_notifications(sender, recipients, title, message, notif_type)

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

    @staticmethod
    def notify_all_active_users(sender, title, message, notif_type='system'):
        """
        Notify all active users in the system (e.g. for global policy changes).
        """
        from .models import User
        recipients = User.objects.filter(is_active=True).exclude(id=sender.id)
        if recipients.exists():
            NotificationService._send_notifications(sender, recipients, title, message, notif_type)

    @staticmethod
    def notify_managers_and_admins(sender, title, message, notif_type='system'):
        """
        Notify all managers and administrators in the system.
        """
        from .models import User
        recipients = User.objects.filter(
            role__in=['manager', 'admin'], 
            is_active=True
        ).exclude(id=sender.id).distinct()
        if recipients.exists():
            NotificationService._send_notifications(sender, recipients, title, message, notif_type)

# ── Attendance Engine ──────────────────────────────────────────────────────────

class AttendanceService:
    """Core attendance engine. Status derived solely from time calculations."""

    @staticmethod
    def auto_checkout_all_active_sessions():
        """
        Global Shift Finalizer: Checks all open sessions against policies.
        Called by management command (cron).
        """
        from .models import WorkSession, AttendancePolicy
        import datetime

        now = timezone.now()
        active_sessions = WorkSession.objects.filter(end_time__isnull=True).select_related('attendance__user')
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        
        if not policy: return 0

        checkout_count = 0
        for session in active_sessions:
            user = session.attendance.user
            if user.role == 'admin': continue # Admins stay logged in
            
            # Combine session date with policy shift end
            tz = timezone.get_current_timezone()
            shift_end_dt = timezone.make_aware(datetime.datetime.combine(session.attendance.date, policy.shift_end_time), tz)
            if shift_end_dt < session.start_time: # Night shift handling
                shift_end_dt += datetime.timedelta(days=1)

            if now >= shift_end_dt:
                # Trigger official checkout
                WorkSessionService.stop_session(user, end_time=shift_end_dt)
                checkout_count += 1
        
        return checkout_count

    @staticmethod
    def notify_upcoming_shifts():
        """Sends reminders to employees 15 mins before shift."""
        from .models import User, AttendancePolicy, Attendance
        import datetime

        now = timezone.localtime(timezone.now())
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if not policy: return 0

        # Calculate target alert window (15 mins before shift)
        shift_time = policy.shift_start_time
        alert_time = (datetime.datetime.combine(date.today(), shift_time) - datetime.timedelta(minutes=15)).time()
        
        # Only notify during the specific 15-min window to avoid spam
        if now.time() < alert_time or now.time() > shift_time:
            return 0

        employees = User.objects.filter(role='employee', is_active=True)
        notif_count = 0
        for emp in employees:
            # If no attendance record yet today, they are likely offline
            if not Attendance.objects.filter(user=emp, date=date.today()).exists():
                message = f"Reminder: Your shift starts at {shift_time.strftime('%I:%M %p')}. Please log in to start work."
                NotificationService.notify_based_on_role(emp, "Upcoming Shift", message, "system")
                notif_count += 1
        
        return notif_count

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
        Uses Interval Union math to prevent any 'double counting' of overlapping sessions.
        """
        from .models import AttendancePolicy

        now = timezone.now()
        sessions = list(attendance.work_sessions.all())
        
        def merge_intervals(intervals):
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

        def sum_intervals(intervals):
            return sum((end - start).total_seconds() for start, end in intervals)

        # 1. Total Work Intervals (Union of all work sessions)
        work_intervals = merge_intervals([(s.start_time, s.end_time or now) for s in sessions if (s.end_time or now) > s.start_time])
        total_work = int(sum_intervals(work_intervals))

        # 2. Total Break Intervals (Union of all breaks, intersected with work)
        all_breaks = []
        for s in sessions:
            ws_start, ws_end = s.start_time, s.end_time or now
            for b in s.break_sessions.all():
                bs_start, bs_end = b.start_time, b.end_time or now
                # Intersection with work session
                eff_start = max(bs_start, ws_start)
                eff_end = min(bs_end, ws_end)
                if eff_end > eff_start:
                    all_breaks.append((eff_start, eff_end))
        total_break = int(sum_intervals(merge_intervals(all_breaks)))

        # 3. Total Idle Intervals (Union of all idles, intersected with work)
        all_idles = []
        for s in sessions:
            ws_start, ws_end = s.start_time, s.end_time or now
            for i in s.idle_logs.all():
                il_start, il_end = i.start_time, i.end_time or now
                # Intersection with work session
                eff_start = max(il_start, ws_start)
                eff_end = min(il_end, ws_end)
                if eff_end > eff_start:
                    all_idles.append((eff_start, eff_end))
        total_idle = int(sum_intervals(merge_intervals(all_idles)))

        # 4. OVERLAP PROTECTION: Unified Unproductive Duration
        # Merge breaks and idles into a single union to prevent double-subtracting overlapping time
        unproductive_union = merge_intervals(all_breaks + all_idles)
        total_unproductive_seconds = int(sum_intervals(unproductive_union))

        # 5. Net Arithmetic Accuracy (Gross Perspective)
        net_work_seconds = max(0, total_work - total_unproductive_seconds)
        
        # 6. Shift Window Policy (Strictness Integration)
        try:
            policy = AttendancePolicy.objects.filter(is_active=True).first()
            present_hours = float(policy.present_hours) if policy else 8.0
            min_hours = float(policy.min_working_hours) if policy else 8.0
            half_day_hours = float(policy.half_day_hours) if policy else 4.0
            idle_threshold_minutes = policy.idle_threshold_minutes if policy else 15
            
            # 6a. Define Shift Window for the specific attendance date
            att_date = attendance.date
            tz = timezone.get_current_timezone()
            shift_start_dt = timezone.make_aware(datetime.datetime.combine(att_date, policy.shift_start_time), tz)
            shift_end_dt = timezone.make_aware(datetime.datetime.combine(att_date, policy.shift_end_time), tz)
            if shift_end_dt <= shift_start_dt: shift_end_dt += datetime.timedelta(days=1)
        except Exception:
            policy = None
            present_hours, min_hours, half_day_hours, idle_threshold_minutes = 8.0, 8.0, 4.0, 15
            shift_start_dt = shift_end_dt = None

        # 7. Shift Intersection Math (Official Attendance Grade)
        shift_work_seconds = 0
        net_shift_work_seconds = 0
        if shift_start_dt and shift_end_dt:
            # Shift Work Union
            for start, end in work_intervals:
                win_start = max(start, shift_start_dt)
                win_end = min(end, shift_end_dt)
                if win_end > win_start:
                    shift_work_seconds += (win_end - win_start).total_seconds()
            
            # Unproductive Intersection within Shift
            shift_unproductive_seconds = 0
            for start, end in unproductive_union:
                win_start = max(start, shift_start_dt)
                win_end = min(end, shift_end_dt)
                if win_end > win_start:
                    shift_unproductive_seconds += (win_end - win_start).total_seconds()
            
            net_shift_work_seconds = max(0, shift_work_seconds - shift_unproductive_seconds)
        else:
            net_shift_work_seconds = net_work_seconds

        # 8. Status Determination (Based on Shift-Aware Net Hours)
        total_work_hours = net_shift_work_seconds / 3600
        
        auto_remark = ""
        if attendance.status in (attendance.STATUS_ON_LEAVE, attendance.STATUS_HOLIDAY):
            status = attendance.status
        elif total_work_hours >= present_hours:
            status = attendance.STATUS_PRESENT
            auto_remark = ""
        elif total_work_hours >= min_hours:
            status = attendance.STATUS_PRESENT
            auto_remark = ""
        elif total_work_hours >= half_day_hours:
            status = attendance.STATUS_HALF_DAY
            auto_remark = f"Shift hours ({total_work_hours:.2f}h) below required {min_hours}h for Full Day."
        elif total_work_hours > 0:
            status = attendance.STATUS_ABSENT
            auto_remark = f"Insufficient work for credit: {total_work_hours:.2f}h recorded within shift (Requirement: {half_day_hours}h for Half-Day)."
        else:
            status = attendance.STATUS_ABSENT
            auto_remark = "No work recorded within shift hours."

        # 9. Dynamic Flagging (Anomalies)
        # Threshold: 50% of total login duration
        idle_percentage = (total_idle / total_work * 100) if total_work > 0 else 0
        should_flag_idle = idle_percentage > 50

        # 10. Persistence
        attendance.total_work_seconds = net_work_seconds
        attendance.total_break_seconds = total_break
        attendance.total_idle_seconds = total_idle
        attendance.status = status

        # Only set automated remark if manager hasn't provided one
        if not attendance.manager_remark or "Hours" in (attendance.manager_remark or "") or "No work" in (attendance.manager_remark or ""):
            attendance.manager_remark = auto_remark

        # Flagging Logic
        if should_flag_idle:
            attendance.is_flagged = True
            attendance.flag_reason = f'High idle time: {idle_percentage:.1f}% of work time'
        elif attendance.is_flagged and 'High idle time' in (attendance.flag_reason or ''):
            # Clear automatically only if it was an idle flag and now it resolves below 30%
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
        
        tz = timezone.get_current_timezone()
        
        # 1. Handle Past Days: Find ALL open sessions where attendance date < today
        past_open_sessions = WorkSession.objects.filter(
            end_time__isnull=True,
            attendance__date__lt=now_local.date()
        ).select_related('attendance__user')
        
        count = 0
        for session in past_open_sessions:
            # For past sessions, we close them at the shift_end_time of THAT SPECIFIC DAY
            session_date = session.attendance.date
            close_time = timezone.make_aware(datetime.datetime.combine(session_date, policy.shift_end_time), tz)
            WorkSessionService.stop_session(session.attendance.user, end_time=close_time, is_auto=True, session=session)
            count += 1

        # 2. Handle Today: Find open sessions for today if shift end time has passed
        shift_end_dt_today = timezone.make_aware(datetime.datetime.combine(now_local.date(), policy.shift_end_time), tz)
        
        if now_local >= shift_end_dt_today:
            today_open_sessions = WorkSession.objects.filter(
                end_time__isnull=True,
                attendance__date=now_local.date()
            ).select_related('attendance__user')
            
            for session in today_open_sessions:
                WorkSessionService.stop_session(session.attendance.user, end_time=shift_end_dt_today, is_auto=True, session=session)
                count += 1
            
        return count

    @staticmethod
    def notify_upcoming_shifts():
        """
        Notify employees 15 minutes before their shift starts.
        Deduplicates notifications to ensure only one alert per day per user.
        """
        from .models import User, AttendancePolicy, Notification
        import datetime
        from django.db.models import Q
        
        now_local = timezone.localtime(timezone.now())
        today = now_local.date()
        
        # Check window: Shifts starting in the next 15 minutes
        window_start = now_local.time()
        window_end = (now_local + datetime.timedelta(minutes=15)).time()
        
        # Find active policies
        policies = AttendancePolicy.objects.filter(is_active=True)
        
        notified_count = 0
        for policy in policies:
            # Check if policy shift_start falls within our window
            if window_start <= policy.shift_start_time <= window_end:
                # Find employees who haven't been notified today for an upcoming shift
                # and haven't logged in yet today.
                users = User.objects.filter(is_active=True, role='employee')
                if policy.department:
                    users = users.filter(department=policy.department)
                
                for user in users:
                    # Logic 1: Has user already logged in today?
                    from .models import Attendance
                    if Attendance.objects.filter(user=user, date=today).exists():
                        continue
                        
                    # Logic 2: Have we already sent an 'Upcoming Shift' notification today?
                    already_notified = Notification.objects.filter(
                        recipient=user,
                        title="Shift Starting Soon",
                        created_at__date=today
                    ).exists()
                    
                    if not already_notified:
                        NotificationService._send_notifications(
                            user, [user],
                            "Shift Starting Soon",
                            f"Reminder: Your shift starts at {policy.shift_start_time.strftime('%I:%M %p')}. Please log in.",
                            "system"
                        )
                        notified_count += 1
                        
        return notified_count


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
    def stop_session(user, end_time=None, is_auto=False, session=None):
        """Stop the active work session and recalculate status."""
        from .models import WorkSession, Attendance

        if session:
            open_session = session
        else:
            # Find the open session for this user. 
            # If there are multiple (which shouldn't happen), we pick the oldest one.
            open_session = WorkSession.objects.filter(
                attendance__user=user,
                end_time__isnull=True
            ).order_by('start_time').first()

        if not open_session:
            return None, False

        attendance = open_session.attendance
        # Sequence lock on parent attendance to prevent double-click creation races
        Attendance.objects.select_for_update().get(id=attendance.id)

        # Capping Logic: If not admin, cap end_time to shift_end_time if it has passed
        stop_time = end_time if end_time else timezone.now()
        
        if user.role != 'admin':
            from .models import AttendancePolicy
            import datetime
            policy = AttendancePolicy.objects.filter(is_active=True).first()
            if policy:
                # Use the date of the attendance record, not necessarily 'today'
                # to handle sessions that were left open from previous days.
                session_date = attendance.date
                shift_end_dt = timezone.make_aware(datetime.datetime.combine(session_date, policy.shift_end_time))
                
                if stop_time > shift_end_dt:
                    stop_time = shift_end_dt
                    is_auto = True # Mark as auto if we capped it

        # Ensure stop_time is NOT before start_time to prevent negative duration
        if stop_time < open_session.start_time:
            stop_time = open_session.start_time
            is_auto = True

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

        # SYNC: Also close any active Monitoring (Screen Share) session
        try:
            from monitoring.models import MonitoringSession
            MonitoringSession.objects.filter(employee=user, is_active=True).update(is_active=False)
        except ImportError:
            pass # Monitoring app might not be installed or enabled

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
    def start_idle(user, start_time=None, reason=None):
        """
        Mark user as idle.
        """
        from .models import WorkSession, IdleLog, AttendancePolicy
        import datetime

        # 1. Enforce shift hours (Idle detection only during shift)
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if policy:
            now_local = timezone.localtime(timezone.now())
            if now_local.time() < policy.shift_start_time or now_local.time() > policy.shift_end_time:
                # Outside shift hours — ignore idle detection request
                return None, False

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

        existing_idle = open_session.idle_logs.select_for_update().filter(end_time__isnull=True).first()
        if existing_idle:
            return existing_idle, False

        # Use provided start_time (retroactive) or current time
        new_start = start_time or timezone.now()

        idle_log = IdleLog.objects.create(
            work_session=open_session,
            start_time=new_start,
        )
        
        # Determine the notification message
        if reason == 'screen_disconnected':
            title = "Screen Disconnected"
            msg = f"{user.full_name} is now Idle (Screen share disconnected after refresh)."
        else:
            threshold_msg = f"after {policy.idle_threshold_minutes} minutes" if policy else "after threshold"
            title = "Idle Detected"
            msg = f"You are now Idle ({threshold_msg} of inactivity)."

        # 1. Notify Employee, Manager, and Admins
        NotificationService.notify_shift_event(user, title, msg, "status")
        
        # 2. Broadcast status change to Live Dashboards
        StatusService.broadcast_status_change(user)

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

        open_idle = open_session.idle_logs.select_for_update().filter(end_time__isnull=True).first()
        if not open_idle:
            return None, False

        open_idle.end_time = timezone.now()
        open_idle.save(update_fields=['end_time', 'updated_at'])
        AttendanceService.recalculate_status(attendance)
        StatusService.broadcast_status_change(user)
        NotificationService.notify_shift_event(
            user, "Back to Work", f"You have returned to work.", "status"
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
            return {'status': status, 'attendance': None, 'session': None}
 
        open_session = WorkSession.objects.filter(
            attendance=attendance,
            end_time__isnull=True
        ).first()
 
        if not open_session:
            status = 'online' if cache.get(f'presence_{user.id}') else 'offline'
            return {'status': status, 'attendance': attendance, 'session': None}

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
        policy = AttendancePolicy.objects.first()
        shift_end = policy.shift_end_time if policy else datetime.time(17, 30)
        
        # IST check
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = timezone.now().astimezone(ist)
        is_before_cutoff = now_ist.time() < shift_end

        from .models import User
        
        # Calculate real team composition based on active users, not just attendance records
        user_qs = User.objects.filter(is_active=True)
        if user_ids is not None:
             user_qs = user_qs.filter(id__in=user_ids)
        else:
             # Admin view: only count those that SHOULD be attending (employees/managers)
             user_qs = user_qs.filter(role__in=['manager', 'employee'])
        
        actual_user_count = user_qs.count()

        total_records = qs.count()
        present = qs.filter(status='present').count()
        half_day = qs.filter(status='half_day').count()
        on_leave = qs.filter(status='on_leave').count()
        
        # Absent logic: only count as absent if it's NOT today or if cutoff passed
        absent_qs = qs.filter(status='absent')
        if is_before_cutoff:
            final_absent = absent_qs.exclude(date=today).count()
            calculating = absent_qs.filter(date=today).count()
        else:
            final_absent = absent_qs.count()
            calculating = 0
            
        # If today, some people might be missing attendance entirely
        # (They haven't logged in, and no dummy record created yet)
        if (not from_date or from_date <= today) and (not to_date or to_date >= today):
            missing_today = max(0, actual_user_count - (total_records if total_records > 0 else 0))
            if is_before_cutoff:
                calculating += missing_today
            else:
                final_absent += missing_today

        absent = final_absent
        avg_work = qs.aggregate(avg=Sum('total_work_seconds'))['avg'] or 0
        avg_idle = qs.aggregate(avg=Sum('total_idle_seconds'))['avg'] or 0

        total_score = 0
        scored_days = 0
        if total_records < 200:
            for d_att in qs.select_related('user'):
                total_score += ProductivityScoringService.calculate_score(d_att.user, d_att.date)
                scored_days += 1
        avg_productivity_score = round(total_score / scored_days) if scored_days > 0 else 0

        return {
            'total': actual_user_count,
            'present': present,
            'half_day': half_day,
            'absent': absent,
            'calculating': calculating,
            'on_leave': on_leave,
            'attendance_rate': round(present / actual_user_count * 100, 1) if actual_user_count > 0 else 0,
            'avg_work_hours': round(avg_work / 3600, 2) if total_records > 0 else 0,
            'avg_idle_hours': round(avg_idle / 3600, 2) if total_records > 0 else 0,
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

        for user in users:
            # 1. Total Days Worked
            present_days = Attendance.objects.filter(
                user=user, 
                date__range=[start_date, end_date],
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
