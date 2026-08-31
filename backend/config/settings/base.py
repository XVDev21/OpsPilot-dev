import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env", override=False)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "local-development-only-change-me")
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "accounts.apps.AccountsConfig",
    "cases.apps.CasesConfig",
    "common.apps.CommonConfig",
    "integrations.apps.IntegrationsConfig",
    "runs.apps.RunsConfig",
    "workitems.apps.WorkItemsConfig",
    "workflows.apps.WorkflowsConfig",
]

MIDDLEWARE = [
    "common.middleware.RequestIdMiddleware",
    "django.middleware.security.SecurityMiddleware",
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
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CASE_EVIDENCE_MAX_BYTES = int(os.getenv("CASE_EVIDENCE_MAX_BYTES", str(8 * 1024 * 1024)))
CASE_EVIDENCE_MAX_PIXELS = int(os.getenv("CASE_EVIDENCE_MAX_PIXELS", "10000000"))
CASE_EVIDENCE_MAX_PER_CASE = int(os.getenv("CASE_EVIDENCE_MAX_PER_CASE", "20"))
CASE_EVIDENCE_MAX_WORKSPACE_ITEMS = int(os.getenv("CASE_EVIDENCE_MAX_WORKSPACE_ITEMS", "200"))
CASE_EVIDENCE_MAX_WORKSPACE_BYTES = int(
    os.getenv("CASE_EVIDENCE_MAX_WORKSPACE_BYTES", str(512 * 1024 * 1024))
)
CASE_ASSESSMENT_MAX_IMAGES = int(os.getenv("CASE_ASSESSMENT_MAX_IMAGES", "8"))
CASE_ASSESSMENT_MAX_IMAGE_BYTES = int(
    os.getenv("CASE_ASSESSMENT_MAX_IMAGE_BYTES", str(24 * 1024 * 1024))
)
CASE_EVIDENCE_S3_BUCKET = os.getenv("CASE_EVIDENCE_S3_BUCKET", "").strip()
CASE_EVIDENCE_UPLOADS_ENABLED = env_bool("CASE_EVIDENCE_UPLOADS_ENABLED", default=True)
FILE_UPLOAD_HANDLERS = ["common.upload_handlers.BoundedTemporaryFileUploadHandler"]
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 1
if CASE_EVIDENCE_S3_BUCKET:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": CASE_EVIDENCE_S3_BUCKET,
                "region_name": os.getenv("CASE_EVIDENCE_S3_REGION", "").strip() or None,
                "endpoint_url": os.getenv("CASE_EVIDENCE_S3_ENDPOINT_URL", "").strip() or None,
                "access_key": os.getenv("CASE_EVIDENCE_S3_ACCESS_KEY", "").strip() or None,
                "secret_key": os.getenv("CASE_EVIDENCE_S3_SECRET_KEY", "").strip() or None,
                "default_acl": None,
                "file_overwrite": False,
                "querystring_auth": True,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").rstrip("/")
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN] if FRONTEND_ORIGIN else []
CORS_ALLOW_CREDENTIALS = False
CSRF_TRUSTED_ORIGINS = [FRONTEND_ORIGIN] if FRONTEND_ORIGIN else []

WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID", "").strip()
WORKOS_ISSUER = os.getenv("WORKOS_ISSUER", "").strip()
WORKOS_JWKS_URL = os.getenv("WORKOS_JWKS_URL", "")
WORKOS_JWKS_CACHE_SECONDS = int(os.getenv("WORKOS_JWKS_CACHE_SECONDS", "300"))
WORKOS_API_KEY = os.getenv("WORKOS_API_KEY", "").strip()
WORKOS_WEBHOOK_SECRET = os.getenv("WORKOS_WEBHOOK_SECRET", "").strip()
WORKOS_INVITATION_EXPIRY_DAYS = int(os.getenv("WORKOS_INVITATION_EXPIRY_DAYS", "14"))

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET", "").strip()
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "OpsPilot <onboarding@resend.dev>").strip()
NOTIFICATION_REPLY_TO_EMAIL = os.getenv("NOTIFICATION_REPLY_TO_EMAIL", "").strip()
NOTIFICATION_OPPORTUNISTIC_LIMIT = int(os.getenv("NOTIFICATION_OPPORTUNISTIC_LIMIT", "2"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "").strip()
QWEN_REGION = os.getenv("QWEN_REGION", "singapore").strip().lower()
QWEN_WORKSPACE_ID = os.getenv("QWEN_WORKSPACE_ID", "").strip()
PROVIDER_CREDENTIAL_ENCRYPTION_KEYS = env_list("PROVIDER_CREDENTIAL_ENCRYPTION_KEYS")
AI_PLATFORM_PROVIDERS = env_list("AI_PLATFORM_PROVIDERS", "gemini")
AI_DEFAULT_PROVIDER = os.getenv("AI_DEFAULT_PROVIDER", "gemini").strip().lower()
AI_DEFAULT_INTELLIGENCE = os.getenv("AI_DEFAULT_INTELLIGENCE", "fast").strip().lower()
AI_REQUEST_TIMEOUT_SECONDS = int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "30"))
AI_RATE_LIMIT_PER_MINUTE = int(os.getenv("AI_RATE_LIMIT_PER_MINUTE", "5"))
AI_RATE_LIMIT_PER_DAY = int(os.getenv("AI_RATE_LIMIT_PER_DAY", "30"))
WORKFLOW_RETENTION_DAYS = int(os.getenv("WORKFLOW_RETENTION_DAYS", "30"))

AI_MODEL_MAP = {
    "gemini": {
        "fast": os.getenv("GEMINI_MODEL_FAST", "gemini-3.5-flash-lite"),
        "balanced": os.getenv("GEMINI_MODEL_BALANCED", "gemini-3.6-flash"),
        "high": os.getenv("GEMINI_MODEL_HIGH", "gemini-2.5-pro"),
    },
    "openai": {
        "fast": os.getenv("OPENAI_MODEL_FAST", "gpt-5.4-nano"),
        "balanced": os.getenv("OPENAI_MODEL_BALANCED", "gpt-5.4-mini"),
        "high": os.getenv("OPENAI_MODEL_HIGH", "gpt-5.6-sol"),
    },
    "qwen": {
        "fast": os.getenv("QWEN_MODEL_FAST", "qwen3.6-flash-2026-04-16"),
        "balanced": os.getenv("QWEN_MODEL_BALANCED", "qwen3.7-plus-2026-05-26"),
        "high": os.getenv("QWEN_MODEL_HIGH", "qwen3.7-max-2026-06-08"),
    },
}
AI_MAX_OUTPUT_TOKENS = {
    "fast": int(os.getenv("AI_MAX_OUTPUT_TOKENS_FAST", "1200")),
    "balanced": int(os.getenv("AI_MAX_OUTPUT_TOKENS_BALANCED", "2200")),
    "high": int(os.getenv("AI_MAX_OUTPUT_TOKENS_HIGH", "3200")),
}

if AI_DEFAULT_PROVIDER not in AI_MODEL_MAP:
    raise ImproperlyConfigured("AI_DEFAULT_PROVIDER must be 'gemini', 'openai', or 'qwen'.")
if any(provider not in AI_MODEL_MAP for provider in AI_PLATFORM_PROVIDERS):
    raise ImproperlyConfigured(
        "AI_PLATFORM_PROVIDERS may contain only 'gemini', 'openai', or 'qwen'."
    )
if AI_DEFAULT_INTELLIGENCE not in AI_MAX_OUTPUT_TOKENS:
    raise ImproperlyConfigured("AI_DEFAULT_INTELLIGENCE must be 'fast', 'balanced', or 'high'.")
if (
    min(
        AI_REQUEST_TIMEOUT_SECONDS,
        AI_RATE_LIMIT_PER_MINUTE,
        AI_RATE_LIMIT_PER_DAY,
        WORKFLOW_RETENTION_DAYS,
    )
    <= 0
):
    raise ImproperlyConfigured("AI limits and workflow retention must be positive integers.")
if (
    min(
        CASE_EVIDENCE_MAX_BYTES,
        CASE_EVIDENCE_MAX_PIXELS,
        CASE_EVIDENCE_MAX_PER_CASE,
        CASE_EVIDENCE_MAX_WORKSPACE_ITEMS,
        CASE_EVIDENCE_MAX_WORKSPACE_BYTES,
        CASE_ASSESSMENT_MAX_IMAGES,
        CASE_ASSESSMENT_MAX_IMAGE_BYTES,
    )
    <= 0
):
    raise ImproperlyConfigured("Case evidence limits must be positive integers.")
if NOTIFICATION_OPPORTUNISTIC_LIMIT < 0 or NOTIFICATION_OPPORTUNISTIC_LIMIT > 10:
    raise ImproperlyConfigured("NOTIFICATION_OPPORTUNISTIC_LIMIT must be between 0 and 10.")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}
