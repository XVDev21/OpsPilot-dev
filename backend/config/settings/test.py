import os

import dj_database_url

from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production"
if os.getenv("DATABASE_URL", "").strip():
    DATABASES = {
        "default": dj_database_url.parse(
            os.environ["DATABASE_URL"],
            conn_max_age=60,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
WORKOS_CLIENT_ID = "client_test_opspilot"
WORKOS_ISSUER = "https://api.workos.com/user_management/client_test_default"
WORKOS_JWKS_URL = "https://api.workos.com/sso/jwks/client_test_opspilot"
RESEND_API_KEY = ""
RESEND_WEBHOOK_SECRET = ""
NOTIFICATION_OPPORTUNISTIC_LIMIT = 0
