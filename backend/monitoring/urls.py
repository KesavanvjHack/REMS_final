from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShiftCheckView, MonitoringSessionViewSet

router = DefaultRouter()
router.register(r'monitoring', MonitoringSessionViewSet, basename='monitoring')

urlpatterns = [
    path('', include(router.urls)),
    path('shift/check/', ShiftCheckView.as_view(), name='shift-check-current'),
    path('shift/check/<uuid:employee_id>/', ShiftCheckView.as_view(), name='shift-check-specific'),
]
