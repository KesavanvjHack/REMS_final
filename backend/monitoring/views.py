from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime, time
from .models import MonitoringSession
from .serializers import MonitoringSessionSerializer
from core.models import User, AttendancePolicy, Shift

class ShiftCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, employee_id=None):
        target_user_id = employee_id or request.user.id
        user = get_object_or_404(User, id=target_user_id)
        
        # Determine shift from AttendancePolicy or Shift model
        # Prioritizing AttendancePolicy for global settings if assigned to department
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if user.department and user.department.policies.filter(is_active=True).exists():
            policy = user.department.policies.filter(is_active=True).first()
        
        shift_start = policy.shift_start_time if policy else time(9, 0)
        shift_end = policy.shift_end_time if policy else time(18, 0)
        
        now = timezone.localtime(timezone.now())
        current_time = now.time()
        
        within_shift = shift_start <= current_time <= shift_end
        
        return Response({
            'within_shift': within_shift,
            'shift_start': shift_start.strftime('%H:%M'),
            'shift_end': shift_end.strftime('%H:%M'),
            'current_time': current_time.strftime('%H:%M')
        })

class MonitoringSessionViewSet(viewsets.ModelViewSet):
    queryset = MonitoringSession.objects.all()
    serializer_class = MonitoringSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='start')
    def start_monitoring(self, request):
        user = request.user
        
        # Logic to calculate shift window for the model
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if user.department and user.department.policies.filter(is_active=True).exists():
            policy = user.department.policies.filter(is_active=True).first()
            
        today = timezone.localtime(timezone.now()).date()
        s_time = policy.shift_start_time if policy else time(9, 0)
        e_time = policy.shift_end_time if policy else time(18, 0)
        
        shift_start = timezone.make_aware(datetime.combine(today, s_time))
        shift_end = timezone.make_aware(datetime.combine(today, e_time))

        # Close any existing active sessions for this user
        MonitoringSession.objects.filter(employee=user, is_active=True).update(is_active=False)

        import uuid
        room_id = f"room_{user.id.hex[:4]}_{uuid.uuid4().hex[:8]}"
        session = MonitoringSession.objects.create(
            employee=user,
            shift_start=shift_start,
            shift_end=shift_end,
            room_id=room_id,
            is_active=True
        )

        return Response(MonitoringSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='stop')
    def stop_monitoring(self, request):
        MonitoringSession.objects.filter(employee=request.user, is_active=True).update(is_active=False)
        return Response({'status': 'stopped'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def current(self, request):
        # Relaxed window: 24 hours to allow for overnight shifts
        since = timezone.now() - timezone.timedelta(hours=24)
        session = MonitoringSession.objects.filter(
            employee=request.user, 
            is_active=True,
            created_at__gte=since
        ).first()
        if not session:
            return Response({'detail': 'No active session found in the last 24h'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MonitoringSessionSerializer(session).data)

    @action(detail=False, methods=['get'], url_path='check-shift')
    def check_shift(self, request):
        user = request.user
        policy = AttendancePolicy.objects.filter(is_active=True).first()
        if user.department and user.department.policies.filter(is_active=True).exists():
            policy = user.department.policies.filter(is_active=True).first()
            
        if not policy:
            # Default fallback if no policy exists
            return Response({
                'within_shift': True, 
                'shift_start': '00:00',
                'shift_end': '23:59'
            })
            
        now = timezone.localtime(timezone.now())
        s_time = policy.shift_start_time
        e_time = policy.shift_end_time
        
        current_time = now.time()
        
        # Handle overnight shifts
        if s_time <= e_time:
            within = s_time <= current_time <= e_time
        else:
            within = current_time >= s_time or current_time <= e_time
            
        return Response({
            'within_shift': within,
            'shift_start': s_time.strftime('%H:%M'),
            'shift_end': e_time.strftime('%H:%M')
        })

    @action(detail=False, methods=['get'], url_path='active-employees')
    def active_employees(self, request):
        if request.user.role not in ['admin', 'manager']:
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Show ALL sessions currently marked as active
        active_sessions = MonitoringSession.objects.filter(
            is_active=True
        ).select_related('employee')
        # Optional: Filter by manager if requester is a manager
        if request.user.role == 'manager':
            active_sessions = active_sessions.filter(employee__manager=request.user)
            
        serializer = MonitoringSessionSerializer(active_sessions, many=True)
        return Response(serializer.data)
