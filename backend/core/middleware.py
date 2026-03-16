"""
Django middleware for automatic audit logging of sensitive actions.
"""

from django.utils import timezone
import json
import logging

logger = logging.getLogger(__name__)

AUDITED_PATHS = [
    '/api/auth/',
    '/api/users/',
    '/api/leave/',
    '/api/policy/',
    '/api/export/',
    '/api/holiday/',
]

AUDITED_METHODS = ('POST', 'PUT', 'PATCH', 'DELETE')


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class AuditLogMiddleware:
    """
    Automatically logs sensitive API actions to AuditLog.
    Runs after view execution so we know if it succeeded.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only log authenticated API mutations on sensitive paths
        if (
            request.user
            and request.user.is_authenticated
            and request.method in AUDITED_METHODS
            and any(request.path.startswith(p) for p in AUDITED_PATHS)
            and response.status_code < 400
        ):
            self._log(request, response)

        return response

    def _log(self, request, response):
        from .models import AuditLog
        from .services import get_client_ip

        method_action_map = {
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }

        action_type = method_action_map.get(request.method, 'update')

        # Specialize certain paths
        if 'login' in request.path:
            action_type = 'login'
        elif 'logout' in request.path:
            action_type = 'logout'
        elif 'export' in request.path:
            action_type = 'export'
        elif 'policy' in request.path:
            action_type = 'policy_change'
        elif 'approve' in request.path:
            action_type = 'approve'
        elif 'reject' in request.path:
            action_type = 'reject'

        try:
            AuditLog.objects.create(
                user=request.user,
                action_type=action_type,
                description=f'{request.method} {request.path}',
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                extra_data={
                    'status_code': response.status_code,
                    'method': request.method,
                    'path': request.path,
                },
            )
        except Exception as e:
            logger.error(f'AuditLogMiddleware error: {e}')
