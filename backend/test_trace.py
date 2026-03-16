import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from django.test import RequestFactory
from core.views import ExportView
from core.models import User

admin = User.objects.filter(role='admin').first()
factory = RequestFactory()
request = factory.get('/api/export/?type=attendance&format=csv')
request.user = admin

view = ExportView.as_view()
response = view(request)
print("Status:", response.status_code)
print("Data:", getattr(response, 'data', None))

if response.status_code == 404:
    # Let's forcibly run the get method to trace it!
    export_view = ExportView()
    export_view.request = request
    export_view.format_kwarg = None
    export_view.kwargs = {}
    try:
        export_view.initial(request)
        print("Initial passed.")
        export_view.get(request)
    except Exception as e:
        import traceback
        traceback.print_exc()
