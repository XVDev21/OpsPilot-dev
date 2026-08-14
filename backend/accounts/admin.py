from django.contrib import admin

from accounts.models import AppUser


@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display = ("workos_user_id", "email", "created_at", "last_seen_at")
    search_fields = ("workos_user_id", "email")
    readonly_fields = ("id", "created_at", "updated_at", "last_seen_at")
