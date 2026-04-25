"""
URL routing for all REMS API endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView, LogoutView, MeView, ChangePasswordView,
    RequestOTPView, VerifyOTPView, RegisterProfileView, DebugDBView,
    UserViewSet, DepartmentViewSet,
    AttendanceViewSet, WorkSessionView, BreakSessionView,
    IdleView, SyncSessionView, RealTimeStatusView, TeamStatusView, TeamTimesheetView,
    LeaveRequestViewSet, HolidayViewSet,
    FlaggedAttendanceView, AttendancePolicyViewSet, TeamListView,
    ReportView, AuditLogViewSet, ExportView,
    IPWhitelistViewSet, ShiftViewSet, ProjectViewSet, TaskViewSet,
    AppUsageLogViewSet, AlertViewSet, DocumentViewSet, ExpenseViewSet,
    NotificationViewSet, ScreenCaptureViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')
router.register(r'departments', DepartmentViewSet, basename='departments')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave', LeaveRequestViewSet, basename='leave')
router.register(r'holidays', HolidayViewSet, basename='holidays')
router.register(r'policy', AttendancePolicyViewSet, basename='policy')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-logs')

# Expanded Phase 10 Modules
router.register(r'ip-whitelist', IPWhitelistViewSet, basename='ip-whitelist')
router.register(r'shifts', ShiftViewSet, basename='shifts')
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'app-logs', AppUsageLogViewSet, basename='app-logs')
router.register(r'alerts', AlertViewSet, basename='alerts')
router.register(r'documents', DocumentViewSet, basename='documents')
router.register(r'expenses', ExpenseViewSet, basename='expenses')
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'screen-captures', ScreenCaptureViewSet, basename='screen-captures')

urlpatterns = [
    # Auth
    path('auth/request-otp/', RequestOTPView.as_view(), name='request-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/register/', RegisterProfileView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),

    # Work Sessions (Module 5)
    path('sessions/work/', WorkSessionView.as_view(), name='work-sessions'),

    # Break Sessions (Module 6)
    path('sessions/break/', BreakSessionView.as_view(), name='break-sessions'),

    # Idle Detection (Module 7)
    path('sessions/idle/', IdleView.as_view(), name='idle'),
    path('sessions/sync/', SyncSessionView.as_view(), name='session-sync'),

    # Real-Time Status (Module 8)
    path('status/me/', RealTimeStatusView.as_view(), name='my-status'),
    path('status/team/', TeamStatusView.as_view(), name='team-status'),
    path('status/team-list/', TeamListView.as_view(), name='team-list'),
    path('sessions/team-timesheet/', TeamTimesheetView.as_view(), name='team-timesheet'),

    # Manager Review – flagged records (Module 12)
    path('attendance/flagged/', FlaggedAttendanceView.as_view(), name='flagged-attendance'),

    # Reports (Module 14)
    path('reports/', ReportView.as_view(), name='reports'),

    # Export (Module 16)
    path('export/', ExportView.as_view(), name='export'),

    path('debug-db/', DebugDBView.as_view(), name='debug-db'),
    # ViewSet routes
    path('', include(router.urls)),
]
