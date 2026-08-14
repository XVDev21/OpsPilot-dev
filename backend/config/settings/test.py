from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
WORKOS_CLIENT_ID = "client_test_opspilot"
WORKOS_ISSUER = "https://api.workos.com"
WORKOS_JWKS_URL = "https://api.workos.com/sso/jwks/client_test_opspilot"
