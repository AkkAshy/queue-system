from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import (
    ChangePasswordView,
    LoginView,
    UserDetailView,
    UserListCreateView,
)
from catalog.views import (
    CategoryDetailView,
    CategoryListView,
    HallDetailView,
    HallListView,
    ServiceDetailView,
    ServiceListView,
)
from queue_app.views import (
    AuditExportView,
    AuditListView,
    CallNextView,
    CounterDetailView,
    CounterListCreateView,
    CurrentTicketView,
    DashboardView,
    HallResetView,
    DisplayActiveView,
    DisplayBoardView,
    DisplaySettingsView,
    DisplayWaitingView,
    StatsExportView,
    StatsView,
    SyncCatalogView,
    SyncEventsView,
    OperatorSessionCreateView,
    OperatorSessionDetailView,
    QueueView,
    ScheduleCurrentView,
    ScheduleDetailView,
    ScheduleListCreateView,
    TicketActionView,
    TicketCreateView,
    TicketRecallView,
    TicketTransferView,
)

urlpatterns = [
    path("django-admin/", admin.site.urls),
    # auth
    path("api/auth/login", LoginView.as_view()),
    path("api/auth/change-password", ChangePasswordView.as_view()),
    # catalog
    path("api/halls", HallListView.as_view()),
    path("api/halls/<int:pk>", HallDetailView.as_view()),
    path("api/halls/<int:pk>/reset", HallResetView.as_view()),
    path("api/categories", CategoryListView.as_view()),
    path("api/categories/<int:pk>", CategoryDetailView.as_view()),
    path("api/services", ServiceListView.as_view()),
    path("api/services/<int:pk>", ServiceDetailView.as_view()),
    # counters + users
    path("api/counters", CounterListCreateView.as_view()),
    path("api/counters/<int:pk>", CounterDetailView.as_view()),
    path("api/users", UserListCreateView.as_view()),
    path("api/users/<int:pk>", UserDetailView.as_view()),
    # dashboard
    path("api/dashboard", DashboardView.as_view()),
    path("api/audit", AuditListView.as_view()),
    path("api/audit/export", AuditExportView.as_view()),
    path("api/stats", StatsView.as_view()),
    path("api/stats/export", StatsExportView.as_view()),
    path("api/sync/catalog", SyncCatalogView.as_view()),
    path("api/sync/events", SyncEventsView.as_view()),
    # tickets (kiosk) + operator transitions.
    # specific paths MUST precede the <uuid:pk> patterns.
    path("api/tickets", TicketCreateView.as_view()),
    path("api/tickets/current", CurrentTicketView.as_view()),
    path("api/tickets/call-next", CallNextView.as_view()),
    path("api/tickets/<uuid:pk>/finish", TicketActionView.as_view(action="finish")),
    path("api/tickets/<uuid:pk>/skip", TicketActionView.as_view(action="skip")),
    path("api/tickets/<uuid:pk>/recall", TicketRecallView.as_view()),
    path("api/tickets/<uuid:pk>/transfer", TicketTransferView.as_view()),
    # operator sessions
    path("api/operator-sessions", OperatorSessionCreateView.as_view()),
    path("api/operator-sessions/<int:pk>", OperatorSessionDetailView.as_view()),
    # work schedule (recurring shifts) — specific path before <int:pk>
    path("api/schedule/current", ScheduleCurrentView.as_view()),
    path("api/schedule", ScheduleListCreateView.as_view()),
    path("api/schedule/<int:pk>", ScheduleDetailView.as_view()),
    # queue + display
    path("api/queue", QueueView.as_view()),
    path("api/display/active", DisplayActiveView.as_view()),
    path("api/display/board", DisplayBoardView.as_view()),
    path("api/display/waiting", DisplayWaitingView.as_view()),
    path("api/display/settings", DisplaySettingsView.as_view()),
    # OpenAPI
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema")),
]
