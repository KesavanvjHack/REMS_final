from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok", "service": "REMS API"}, status=200)


urlpatterns = [
    path('', health_check),
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/monitor/', include('monitoring.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
