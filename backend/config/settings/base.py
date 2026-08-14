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
    "common.apps.CommonConfig",
    "runs.apps.RunsConfig",
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
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").rstrip("/")
CORS_ALLOWED_ORIGINS = [FRONTEND_ORIGIN] if FRONTEND_ORIGIN else []
CORS_ALLOW_CREDENTIALS = False
CSRF_TRUSTED_ORIGINS = [FRONTEND_ORIGIN] if FRONTEND_ORIGIN else []

WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID", "")
WORKOS_ISSUER = os.getenv("WORKOS_ISSUER", "https://api.workos.com").rstrip("/")
WORKOS_JWKS_URL = os.getenv("WORKOS_JWKS_URL", "")
WORKOS_JWKS_CACHE_SECONDS = int(os.getenv("WORKOS_JWKS_CACHE_SECONDS", "300"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
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
}
AI_MAX_OUTPUT_TOKENS = {
    "fast": int(os.getenv("AI_MAX_OUTPUT_TOKENS_FAST", "1200")),
    "balanced": int(os.getenv("AI_MAX_OUTPUT_TOKENS_BALANCED", "2200")),
    "high": int(os.getenv("AI_MAX_OUTPUT_TOKENS_HIGH", "3200")),
}

if AI_DEFAULT_PROVIDER not in AI_MODEL_MAP:
    raise ImproperlyConfigured("AI_DEFAULT_PROVIDER must be 'gemini' or 'openai'.")
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
