from django.contrib import admin

from cases.models import (
    CaseAssessment,
    CaseAssignment,
    CaseEvent,
    CaseEvidence,
    MemberNotificationPreference,
    Notification,
    NotificationDelivery,
    NotificationDeliveryAttempt,
    OperationsCase,
    ResendWebhookReceipt,
    Workspace,
    WorkspaceMember,
    WorkspaceNotificationPolicy,
)

admin.site.register(Workspace)
admin.site.register(WorkspaceMember)
admin.site.register(OperationsCase)
admin.site.register(CaseAssignment)
admin.site.register(CaseEvent)
admin.site.register(CaseEvidence)
admin.site.register(CaseAssessment)
admin.site.register(WorkspaceNotificationPolicy)
admin.site.register(MemberNotificationPreference)
admin.site.register(Notification)
admin.site.register(NotificationDelivery)
admin.site.register(NotificationDeliveryAttempt)
admin.site.register(ResendWebhookReceipt)
