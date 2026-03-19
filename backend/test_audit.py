import os, sys, django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rems_backend.settings")
django.setup()

from core.models import AuditLog
from core.serializers import AuditLogSerializer
import traceback

print("Starting serialization test...")
qs = AuditLog.objects.all()[:10]
try:
    data = AuditLogSerializer(qs, many=True).data
    print("SUCCESS, length:", len(data))
    if data: print(data[0])
except Exception as e:
    print("ERROR CAUGHT:")
    traceback.print_exc()
