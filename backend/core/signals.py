"""
Django Signals for REMS.
post_save signal on WorkSession: whenever a manager saves a session record,
an Admin Notification is created automatically.

Connect this in apps.py (core/apps.py) via the ready() hook.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='core.WorkSession')
def notify_admins_on_manager_session(sender, instance, created, **kwargs):
    """
    Post-save signal disabled because WorkSessionService already manually triggers
    NotificationService.notify_based_on_role() during start_session and stop_session.
    Leaving this active caused duplicate/triplicate notifications on every background save.
    """
    pass
