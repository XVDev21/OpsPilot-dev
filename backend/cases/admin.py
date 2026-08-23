from django.contrib import admin

from cases.models import (
    CaseAssessment,
    CaseAssignment,
    CaseEvent,
    CaseEvidence,
    OperationsCase,
    Workspace,
    WorkspaceMember,
)

admin.site.register(Workspace)
admin.site.register(WorkspaceMember)
admin.site.register(OperationsCase)
admin.site.register(CaseAssignment)
admin.site.register(CaseEvent)
admin.site.register(CaseEvidence)
admin.site.register(CaseAssessment)
