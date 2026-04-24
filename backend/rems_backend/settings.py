# """
# Django settings for rems_backend project.
# """

# from pathlib import Path
# from datetime import timedelta
# import os
# from dotenv import load_dotenv

# load_dotenv()

# BASE_DIR = Path(__file__).resolve().parent.parent

# SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-rems-secret-key-change-in-production-2024')

# DEBUG = os.getenv('DEBUG', 'True') == 'True'

# # ─── Security ──────────────────────────────────────────────────────────────────
# ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost 127.0.0.1 [::1] *').split()

# INSTALLED_APPS = [
#     'unfold',
#     'unfold.contrib.filters',
#     'unfold.contrib.forms',
#     'unfold.contrib.import_export',
#     'import_export',
#     'daphne',
#     'django.contrib.admin',
#     'django.contrib.auth',
#     'django.contrib.contenttypes',
#     'django.contrib.sessions',
#     'django.contrib.messages',
#     'django.contrib.staticfiles',
#     # Third-party
#     'rest_framework',
#     'rest_framework_simplejwt',
#     'rest_framework_simplejwt.token_blacklist',
#     'corsheaders',
#     'django_filters',
#     # Local
#     'core',
#     'monitoring',
#     'channels',
# ]

# MIDDLEWARE = [
#     'corsheaders.middleware.CorsMiddleware',
#     'django.middleware.security.SecurityMiddleware',
#     'django.contrib.sessions.middleware.SessionMiddleware',
#     'django.middleware.common.CommonMiddleware',
#     'django.middleware.csrf.CsrfViewMiddleware',
#     'django.contrib.auth.middleware.AuthenticationMiddleware',
#     'django.contrib.messages.middleware.MessageMiddleware',
#     'django.middleware.clickjacking.XFrameOptionsMiddleware',
#     'core.middleware.AuditLogMiddleware',
# ]

# ROOT_URLCONF = 'rems_backend.urls'

# TEMPLATES = [
#     {
#         'BACKEND': 'django.template.backends.django.DjangoTemplates',
#         'DIRS': [],
#         'APP_DIRS': True,
#         'OPTIONS': {
#             'context_processors': [
#                 'django.template.context_processors.debug',
#                 'django.template.context_processors.request',
#                 'django.contrib.auth.context_processors.auth',
#                 'django.contrib.messages.context_processors.messages',
#             ],
#         },
#     },
# ]

# WSGI_APPLICATION = 'rems_backend.wsgi.application'
# ASGI_APPLICATION = 'rems_backend.asgi.application'

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': 'rems_db',
#         'USER': 'root',
#         'PASSWORD': 'root',
#         'HOST': 'localhost',
#         'PORT': '3306',
#     }
# }

# AUTH_USER_MODEL = 'core.User'

# AUTH_PASSWORD_VALIDATORS = [
#     {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
# ]

# LANGUAGE_CODE = 'en-us'
# TIME_ZONE = 'Asia/Kolkata'
# USE_I18N = True
# USE_TZ = True

# STATIC_URL = 'static/'
# STATIC_ROOT = BASE_DIR / 'staticfiles'
# MEDIA_URL = '/media/'
# MEDIA_ROOT = BASE_DIR / 'media'

# DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# # ─── CORS ─────────────────────────────────────────────────────────────────────
# CORS_ALLOWED_ORIGINS = [
#     'http://localhost:5173',
#     'http://127.0.0.1:5173',
#     'http://localhost:5174',
#     'http://127.0.0.1:5174',
#     'http://localhost:5175',
#     'http://127.0.0.1:5175',
# ]
# CORS_ALLOW_CREDENTIALS = True

# # ─── Django REST Framework ─────────────────────────────────────────────────────
# REST_FRAMEWORK = {
#     'DEFAULT_AUTHENTICATION_CLASSES': [
#         'rest_framework_simplejwt.authentication.JWTAuthentication',
#     ],
#     'DEFAULT_PERMISSION_CLASSES': [
#         'rest_framework.permissions.IsAuthenticated',
#     ],
#     'DEFAULT_FILTER_BACKENDS': [
#         'django_filters.rest_framework.DjangoFilterBackend',
#         'rest_framework.filters.SearchFilter',
#         'rest_framework.filters.OrderingFilter',
#     ],
#     'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
#     'PAGE_SIZE': 20,
#     'DEFAULT_THROTTLE_CLASSES': [
#         'rest_framework.throttling.AnonRateThrottle',
#         'rest_framework.throttling.UserRateThrottle'
#     ],
#     'DEFAULT_THROTTLE_RATES': {
#         'anon': '30/minute',
#         'user': '120/minute'
#     }
# }

# # ─── SimpleJWT ─────────────────────────────────────────────────────────────────
# SIMPLE_JWT = {
#     'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
#     'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
#     'ROTATE_REFRESH_TOKENS': True,
#     'BLACKLIST_AFTER_ROTATION': True,
#     'UPDATE_LAST_LOGIN': True,
#     'ALGORITHM': 'HS256',
#     'SIGNING_KEY': SECRET_KEY,
#     'AUTH_HEADER_TYPES': ('Bearer',),
#     'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
#     'JTI_CLAIM': 'jti',
#     'TOKEN_TYPE_CLAIM': 'token_type',
# }

# # ─── Unfold Admin Theme ───────────────────────────────────────────────────────
# UNFOLD = {
#     "SITE_TITLE": "REMS Admin Portal",
#     "SITE_HEADER": "REMS",
#     "SITE_SYMBOL": "speed", # material symbol
#     "SHOW_HISTORY": True,
#     "SHOW_VIEW_ON_SITE": True,
#     "THEME": "dark",
#     "COLORS": {
#         "primary": {
#             "50": "238 242 255",
#             "100": "224 231 255",
#             "200": "199 210 254",
#             "300": "165 180 252",
#             "400": "129 140 248",
#             "500": "99 102 241", # Indigo-500
#             "600": "79 70 229",
#             "700": "67 56 202",
#             "800": "55 48 163",
#             "900": "49 46 129",
#             "950": "30 27 75",
#         },
#     },
#     "DASHBOARD_CALLBACK": "core.dashboard.dashboard_callback",
#     "SIDEBAR": {
#         "show_search": True,
#         "show_all_applications": False,
#         "navigation": [
#             {
#                 "title": "Workforce Management",
#                 "items": [
#                     {
#                         "title": "Employees",
#                         "link": "/admin/core/user/",
#                         "icon": "person", 
#                     },
#                     {
#                         "title": "Attendance Hub",
#                         "link": "/admin/core/attendance/",
#                         "icon": "calendar_month",
#                     },
#                     {
#                         "title": "Leave Center",
#                         "link": "/admin/core/leaverequest/",
#                         "icon": "event_busy",
#                     },
#                     {
#                         "title": "Departments",
#                         "link": "/admin/core/department/",
#                         "icon": "groups",
#                     },
#                 ],
#             },
#             {
#                 "title": "Operational Control",
#                 "items": [
#                     {
#                         "title": "Active Projects",
#                         "link": "/admin/core/project/",
#                         "icon": "corporate_fare",
#                     },
#                     {
#                         "title": "Tasks & Productivity",
#                         "link": "/admin/core/task/",
#                         "icon": "assignment",
#                     },
#                     {
#                         "title": "Shift Schedules",
#                         "link": "/admin/core/shift/",
#                         "icon": "schedule",
#                     },
#                     {
#                         "title": "Policies",
#                         "link": "/admin/core/attendancepolicy/",
#                         "icon": "policy",
#                     },
#                 ],
#             },
#             {
#                 "title": "Activity Monitoring",
#                 "items": [
#                     {
#                         "title": "Screen Captures",
#                         "link": "/admin/core/screencapture/",
#                         "icon": "screenshot",
#                     },
#                     {
#                         "title": "Break Sessions",
#                         "link": "/admin/core/breaksession/",
#                         "icon": "coffee",
#                     },
#                     {
#                         "title": "Idle Time Logs",
#                         "link": "/admin/core/idlelog/",
#                         "icon": "timer_off",
#                     },
#                     {
#                         "title": "App & Web Usage",
#                         "link": "/admin/core/appusagelog/",
#                         "icon": "monitoring",
#                     },
#                 ],
#             },
#             {
#                 "title": "Security & System",
#                 "items": [
#                     {
#                         "title": "Security Audit Logs",
#                         "link": "/admin/core/auditlog/",
#                         "icon": "security",
#                     },
#                     {
#                         "title": "IP Whitelist",
#                         "link": "/admin/core/ipwhitelist/",
#                         "icon": "vpn_lock",
#                     },
#                     {
#                         "title": "System Notifications",
#                         "link": "/admin/core/notification/",
#                         "icon": "notifications",
#                     },
#                 ],
#             },
#         ],
#     },
# }

# # ─── Django Channels ───────────────────────────────────────────────────────────
# CHANNEL_LAYERS = {
#     "default": {
#         "BACKEND": "channels.layers.InMemoryChannelLayer",
#     },
# }

# # ─── Email ─────────────────────────────────────────────────────────────────────
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# # ─── Production Security Hardening ──────────────────────────────────────────────
# # These settings ensure maximum protection in production (HTTPS)
# # while remaining compatible with local development (HTTP).

# SESSION_COOKIE_HTTPONLY = True
# CSRF_COOKIE_HTTPONLY = True
# SESSION_COOKIE_SAMESITE = 'Lax'
# CSRF_COOKIE_SAMESITE = 'Lax'
# X_FRAME_OPTIONS = 'DENY'
# SECURE_CONTENT_TYPE_NOSNIFF = True
# SECURE_BROWSER_XSS_FILTER = True

# if not DEBUG:
#     # Production-only Security (requires HTTPS)
#     SECURE_SSL_REDIRECT = True
#     SESSION_COOKIE_SECURE = True
#     CSRF_COOKIE_SECURE = True
#     SECURE_HSTS_SECONDS = 31536000 # 1 year
#     SECURE_HSTS_INCLUDE_SUBDOMAINS = True
#     SECURE_HSTS_PRELOAD = True
#     SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
#     # Additional session safety
#     SESSION_COOKIE_AGE = 3600 * 24 # 24 hours
#     SESSION_EXPIRE_AT_BROWSER_CLOSE = True


from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-rems-secret-key')

DEBUG = False  # IMPORTANT for production

ALLOWED_HOSTS = ['*']  # Allow Render domain

# ─── INSTALLED APPS ─────────────────────────────────────────────
INSTALLED_APPS = [
    'unfold',
    'unfold.contrib.filters',
    'unfold.contrib.forms',
    'unfold.contrib.import_export',
    'import_export',
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',

    'core',
    'monitoring',
    'channels',
]

# ─── MIDDLEWARE ─────────────────────────────────────────────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # IMPORTANT for static
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.AuditLogMiddleware',
]

ROOT_URLCONF = 'rems_backend.urls'

WSGI_APPLICATION = 'rems_backend.wsgi.application'
ASGI_APPLICATION = 'rems_backend.asgi.application'

# ─── DATABASE (SQLITE - FREE) ─────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_USER_MODEL = 'core.User'

# ─── BASIC SETTINGS ───────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# ─── STATIC FILES (VERY IMPORTANT) ────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── CORS (ALLOW FRONTEND) ────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ─── REST FRAMEWORK ───────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# ─── JWT ──────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── CHANNELS (LIMITED SUPPORT ON RENDER) ─────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# ─── SECURITY (SAFE DEFAULTS) ─────────────────────────────────
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True