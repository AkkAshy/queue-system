from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from accounts.views import LoginView, UserDetailView, UserListCreateView
from catalog.views import (
    CategoryDetailView,
    CategoryListView,
    ServiceDetailView,
    ServiceListView,
)
from queue_app.views import (
    CallNextView,
    CounterDetailView,
    CounterListCreateView,
    CurrentTicketView,
    DashboardView,
    DisplayActiveView,
    OperatorSessionCreateView,
    OperatorSessionDetailView,
    QueueView,
    TicketActionView,
    TicketCreateView,
    TicketTransferView,
)

urlpatterns = [
    path("django-admin/", admin.site.urls),
    # auth
    path("api/auth/login", LoginView.as_view()),
    # catalog
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
    # tickets (kiosk) + operator transitions.
    # specific paths MUST precede the <uuid:pk> patterns.
    path("api/tickets", TicketCreateView.as_view()),
    path("api/tickets/current", CurrentTicketView.as_view()),
    path("api/tickets/call-next", CallNextView.as_view()),
    path("api/tickets/<uuid:pk>/finish", TicketActionView.as_view(action="finish")),
    path("api/tickets/<uuid:pk>/skip", TicketActionView.as_view(action="skip")),
    path("api/tickets/<uuid:pk>/transfer", TicketTransferView.as_view()),
    # operator sessions
    path("api/operator-sessions", OperatorSessionCreateView.as_view()),
    path("api/operator-sessions/<int:pk>", OperatorSessionDetailView.as_view()),
    # queue + display
    path("api/queue", QueueView.as_view()),
    path("api/display/active", DisplayActiveView.as_view()),
    # OpenAPI
    path("api/schema", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs", SpectacularSwaggerView.as_view(url_name="schema")),
]
