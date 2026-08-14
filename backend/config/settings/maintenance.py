import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

database_url = os.getenv("DATABASE_URL", "").strip()
if not database_url:
    raise ImproperlyConfigured("DATABASE_URL must be set for maintenance commands.")

DEBUG = False
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "maintenance-command-only")
DATABASES = {
    "default": dj_database_url.parse(
        database_url,
        conn_max_age=60,
        conn_health_checks=True,
        ssl_require=True,
    )
}
