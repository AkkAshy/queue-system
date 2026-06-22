"""Django settings for the NDPI queue backend (config project)."""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, True),
)
# Load .env if present (local dev). Production passes real env vars.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env(
    "SECRET_KEY",
    default="django-insecure-dev-only-change-me-in-prod-0e6fee6",
)
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "daphne",  # must precede staticfiles so runserver uses the ASGI server
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "channels",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    # local
    "accounts",
    "catalog",
    "queue_app",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---- Channels (realtime) ----
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.pubsub.RedisPubSubChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://localhost:6379/0")],
        },
    },
}

# Database — local Postgres in dev (DATABASE_URL), prod passes its own.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://akkanat@localhost:5432/queue_system",
    ),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
# ---- Загружаемые медиа (озвучка табло и т.п.) ----
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---- DRF + auth ----
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Phase 6 parity with the mock layer (no auth enforcement). Login still
    # issues a real JWT; per-endpoint hardening is a later step.
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "NDPI Queue API",
    "DESCRIPTION": "Electronic queue for the NDPI registrar's office.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ---- CORS — the four Next.js frontends ----
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:3001",  # kiosk
        "http://localhost:3002",  # admin
        "http://localhost:3003",  # operator
        "http://localhost:3004",  # display
    ],
)

# ---- Local-first sync (Phase D) ----
# SYNC_ROLE: "cloud" (authoritative catalog + ingest endpoint) or "local" (the
# on-site box that pulls catalog and pushes events). CLOUD_URL/SYNC_TOKEN are
# only needed on a local box. SYNC_TOKEN also guards the cloud's /api/sync/*.
SYNC_ROLE = env("SYNC_ROLE", default="cloud")
CLOUD_URL = env("CLOUD_URL", default="").rstrip("/")
SYNC_TOKEN = env("SYNC_TOKEN", default="")
# Worker cadence + offline backoff (seconds).
SYNC_INTERVAL = env.int("SYNC_INTERVAL", default=15)
SYNC_BACKOFF_MAX = env.int("SYNC_BACKOFF_MAX", default=300)
