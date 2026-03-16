"""
Custom DRF permission classes implementing RBAC.
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Grants access only to users with role='admin'."""
    message = 'Admin access required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsManager(BasePermission):
    """Grants access to managers and admins."""
    message = 'Manager access required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('admin', 'manager')
        )


class IsEmployee(BasePermission):
    """Grants access to any authenticated user (all roles)."""
    message = 'Authentication required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsAdminOrManagerReadOnly(BasePermission):
    """Admins can do anything; managers get read-only."""
    message = 'Insufficient permissions.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'admin':
            return True
        if request.user.role == 'manager' and request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return False


class IsOwnerOrManager(BasePermission):
    """Allow if the object belongs to the user, or if user is manager/admin."""
    message = 'You do not have permission to access this resource.'

    def has_object_permission(self, request, view, obj):
        if request.user.role in ('admin', 'manager'):
            return True
        # For attendance / leave requests – check ownership
        owner = getattr(obj, 'user', None) or getattr(obj, 'employee', None)
        return owner == request.user
