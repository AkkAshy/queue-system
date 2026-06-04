from django.db.models import Avg, F
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Service, ServiceCategory

from . import audit, realtime, services, sync
from .audit import AuditCRUDMixin
from .models import AuditLog, Counter, DisplaySettings, OperatorSession, Ticket, TicketStatus
from .serializers import (
    AuditLogSerializer,
    CounterSerializer,
    CreateTicketSerializer,
    DisplayBoardCounterSerializer,
    DisplayCallSerializer,
    DisplaySettingsSerializer,
    DisplayWaitingSerializer,
    OperatorSessionSerializer,
    TicketSerializer,
)


# ---------- counters ----------
class CounterListCreateView(AuditCRUDMixin, generics.ListCreateAPIView):
    audit_entity = "counter"
    queryset = Counter.objects.all()
    serializer_class = CounterSerializer
    pagination_class = None


class CounterDetailView(AuditCRUDMixin, generics.RetrieveUpdateDestroyAPIView):
    audit_entity = "counter"
    queryset = Counter.objects.all()
    serializer_class = CounterSerializer


# ---------- tickets (kiosk) ----------
class TicketCreateView(APIView):
    def post(self, request):
        ser = CreateTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        category = ServiceCategory.objects.filter(id=data["category_id"]).first()
        if not category:
            return Response({"error": "unknown category"}, status=400)
        service = None
        if data.get("service_id"):
            service = Service.objects.filter(id=data["service_id"]).first()
        ticket = services.create_ticket(
            category=category, service=service, idempotency_key=data["idempotency_key"]
        )
        realtime.broadcast(
            [realtime.DISPLAY, realtime.OPERATORS, realtime.ADMIN], "ticket.created"
        )
        return Response(TicketSerializer(ticket).data, status=201)


# ---------- dashboard ----------
class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        todays = Ticket.objects.filter(created_at__date=today)
        served_qs = todays.filter(status=TicketStatus.SERVED)
        wait = (
            todays.filter(called_at__isnull=False)
            .annotate(w=F("called_at") - F("created_at"))
            .aggregate(avg=Avg("w"))["avg"]
        )
        avg_wait_min = int(wait.total_seconds() // 60) if wait else 0

        hourly = []
        for hour in range(8, 18):
            hourly.append(
                {
                    "hour": hour,
                    "issued": todays.filter(created_at__hour=hour).count(),
                    "served": served_qs.filter(called_at__hour=hour).count(),
                }
            )

        recent = []
        for t in Ticket.objects.select_related("category", "service", "counter").order_by(
            "-created_at"
        )[:10]:
            recent.append(
                {
                    "id": str(t.id),
                    "number": t.number,
                    "category_code": t.category.code,
                    "service_name": t.service.name_ru if t.service_id else "",
                    "status": t.status,
                    "counter_number": t.counter.number if t.counter_id else None,
                    "issued_at": t.created_at.isoformat(),
                }
            )

        return Response(
            {
                "metrics": {
                    "ticketsToday": todays.count(),
                    "avgWaitMinutes": avg_wait_min,
                    "activeCounters": Counter.objects.filter(is_active=True).count(),
                    "served": served_qs.count(),
                },
                "hourly": hourly,
                "recent": recent,
            }
        )


# ---------- statistics ----------
def _stats_qs(params):
    qs = Ticket.objects.all()
    if params.get("hall"):
        qs = qs.filter(hall_id=params["hall"])
    if params.get("from"):
        qs = qs.filter(created_at__date__gte=params["from"])
    if params.get("to"):
        qs = qs.filter(created_at__date__lte=params["to"])
    return qs


def _compute_stats(qs):
    served = qs.filter(status=TicketStatus.SERVED)
    wait = (
        qs.filter(called_at__isnull=False)
        .annotate(w=F("called_at") - F("created_at"))
        .aggregate(a=Avg("w"))["a"]
    )
    svc = (
        served.filter(finished_at__isnull=False, called_at__isnull=False)
        .annotate(s=F("finished_at") - F("called_at"))
        .aggregate(a=Avg("s"))["a"]
    )
    hourly = []
    peak_hour, peak_count = None, -1
    for hour in range(8, 19):
        cnt = qs.filter(created_at__hour=hour).count()
        hourly.append({"hour": hour, "issued": cnt})
        if cnt > peak_count:
            peak_hour, peak_count = hour, cnt
    return {
        "issued": qs.count(),
        "served": served.count(),
        "skipped": qs.filter(status=TicketStatus.SKIPPED).count(),
        "avg_wait_minutes": int(wait.total_seconds() // 60) if wait else 0,
        "avg_service_minutes": int(svc.total_seconds() // 60) if svc else 0,
        "peak_hour": peak_hour if peak_count > 0 else None,
        "hourly": hourly,
    }


class StatsView(APIView):
    """Aggregated stats: served / avg wait / avg service / skipped / peak hour.
    Filters: ?hall=&from=YYYY-MM-DD&to=YYYY-MM-DD."""

    def get(self, request):
        return Response(_compute_stats(_stats_qs(request.query_params)))


class StatsExportView(APIView):
    """CSV export of per-ticket records for the range (opens in Excel)."""

    def get(self, request):
        import csv

        from django.http import HttpResponse

        qs = _stats_qs(request.query_params).select_related(
            "hall", "category", "counter", "operator"
        ).order_by("created_at")
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="stats.csv"'
        resp.write("﻿")  # BOM so Excel reads UTF-8 (Cyrillic)
        w = csv.writer(resp)
        w.writerow(["number", "hall", "category", "status", "counter",
                    "operator", "created_at", "called_at", "finished_at"])
        for t in qs:
            w.writerow([
                t.number,
                t.hall.name_ru if t.hall_id else "",
                t.category.code if t.category_id else "",
                t.status,
                t.counter.number if t.counter_id else "",
                t.operator.username if t.operator_id else "",
                t.created_at.isoformat(),
                t.called_at.isoformat() if t.called_at else "",
                t.finished_at.isoformat() if t.finished_at else "",
            ])
        return resp


# ---------- operator sessions ----------
class OperatorSessionCreateView(APIView):
    def post(self, request):
        counter = Counter.objects.filter(id=request.data.get("counter_id")).first()
        if not counter:
            return Response({"error": "unknown counter"}, status=404)
        session = OperatorSession.objects.create(
            user_id=request.data.get("user_id"), counter=counter
        )
        return Response(OperatorSessionSerializer(session).data, status=201)


class OperatorSessionDetailView(APIView):
    def patch(self, request, pk):
        session = OperatorSession.objects.filter(id=pk).first()
        if not session:
            return Response({"error": "not found"}, status=404)
        services.set_session_status(session, request.data.get("status"))
        return Response(OperatorSessionSerializer(session).data)


# ---------- queue + current ----------
class QueueView(APIView):
    def get(self, request):
        counter = Counter.objects.filter(
            id=request.query_params.get("counter_id")
        ).first()
        if not counter:
            return Response({"error": "unknown counter"}, status=404)
        q = services.queue_for_counter(counter)[:20]
        return Response(TicketSerializer(q, many=True).data)


class CurrentTicketView(APIView):
    def get(self, request):
        counter = Counter.objects.filter(
            id=request.query_params.get("counter_id")
        ).first()
        current = services.current_for_counter(counter) if counter else None
        if not current:
            # JSON `null` (DRF Response(None) yields an empty body, which the
            # frontend's res.json() can't parse).
            return JsonResponse(None, safe=False)
        return Response(TicketSerializer(current).data)


# ---------- transitions ----------
class CallNextView(APIView):
    def post(self, request):
        counter = Counter.objects.filter(id=request.data.get("counter_id")).first()
        if not counter:
            return Response({"error": "unknown counter"}, status=404)
        ticket = services.call_next(
            counter=counter, operator_id=request.data.get("operator_id")
        )
        if not ticket:
            return Response({"error": "queue empty"}, status=409)
        audit.log(
            request, "ticket.called", target=ticket.number,
            actor_label=str(request.data.get("operator_id") or ""),
            counter=counter.number,
        )
        realtime.broadcast(
            [realtime.DISPLAY, realtime.OPERATORS, realtime.ADMIN], "ticket.called"
        )
        return Response(TicketSerializer(ticket).data)


class TicketActionView(APIView):
    """finish / skip via the URL-configured `action`."""

    action = None

    def post(self, request, pk):
        ticket = Ticket.objects.filter(id=pk).first()
        if not ticket:
            return Response({"error": "not found"}, status=404)
        if self.action == "finish":
            services.finish(ticket)
        elif self.action == "skip":
            services.skip(ticket)
        audit.log(request, f"ticket.{self.action}ed", target=ticket.number)
        realtime.broadcast(
            [realtime.DISPLAY, realtime.OPERATORS, realtime.ADMIN],
            f"ticket.{self.action}ed",
        )
        return Response(TicketSerializer(ticket).data)


class TicketRecallView(APIView):
    """Repeat the announcement for a current call (operator 'Repeat' button)."""

    def post(self, request, pk):
        ticket = Ticket.objects.filter(id=pk).first()
        if not ticket:
            return Response({"error": "not found"}, status=404)
        services.recall(ticket)
        audit.log(request, "ticket.recalled", target=ticket.number)
        realtime.broadcast(
            [realtime.DISPLAY, realtime.OPERATORS, realtime.ADMIN], "ticket.called"
        )
        return Response(TicketSerializer(ticket).data)


class TicketTransferView(APIView):
    def post(self, request, pk):
        ticket = Ticket.objects.filter(id=pk).first()
        if not ticket:
            return Response({"error": "not found"}, status=404)
        counter = Counter.objects.filter(id=request.data.get("counter_id")).first()
        if not counter:
            return Response({"error": "unknown counter"}, status=404)
        services.transfer(ticket, counter)
        audit.log(
            request, "ticket.transferred", target=ticket.number,
            to_counter=counter.number,
        )
        realtime.broadcast(
            [realtime.DISPLAY, realtime.OPERATORS, realtime.ADMIN], "ticket.transferred"
        )
        return Response(TicketSerializer(ticket).data)


# ---------- display ----------
class DisplayActiveView(APIView):
    def get(self, request):
        hall_id = request.query_params.get("hall_id")
        calls = services.active_calls(limit=12, hall_id=hall_id)
        return Response(DisplayCallSerializer(calls, many=True).data)


class DisplayBoardView(APIView):
    """All active windows + the current call on each (null when idle).
    Powers the board's window strip — scoped to a hall when ?hall_id= given."""

    def get(self, request):
        counters = Counter.objects.filter(is_active=True)
        hall_id = request.query_params.get("hall_id")
        if hall_id:
            counters = counters.filter(hall_id=hall_id)
        counters = list(counters)
        for c in counters:
            c.current = services.current_for_counter(c)
        return Response(DisplayBoardCounterSerializer(counters, many=True).data)


class DisplayWaitingView(APIView):
    """The waiting queue (issued, not yet called) shown on the board so a
    visitor sees their number before it's called. Scoped to a hall when given."""

    def get(self, request):
        hall_id = request.query_params.get("hall_id")
        return Response(
            DisplayWaitingSerializer(
                services.waiting_list(20, hall_id=hall_id), many=True
            ).data
        )


# ---------- sync (local-first) ----------
class SyncCatalogView(APIView):
    """cloud → local: full catalog snapshot the local box mirrors."""

    def get(self, request):
        return Response(sync.catalog_snapshot())


class SyncEventsView(APIView):
    """local → cloud: upsert tickets / sessions / audit pushed from a box."""

    def post(self, request):
        counts = sync.ingest_events(request.data or {})
        return Response({"ok": True, **counts})


# ---------- audit ----------
class AuditListView(generics.ListAPIView):
    """Audit journal with optional filters (?action=&actor=&from=&to=). Capped
    at 200 newest. Chief-only once auth enforcement lands."""

    serializer_class = AuditLogSerializer
    pagination_class = None

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor").all()
        p = self.request.query_params
        if p.get("action"):
            qs = qs.filter(action=p["action"])
        if p.get("actor"):
            qs = qs.filter(actor_id=p["actor"])
        if p.get("from"):
            qs = qs.filter(created_at__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(created_at__lte=p["to"])
        return qs[:200]


class DisplaySettingsView(APIView):
    """Board config (YouTube URL). GET for the board, PATCH from the admin app."""

    def get(self, request):
        return Response(DisplaySettingsSerializer(DisplaySettings.load()).data)

    def patch(self, request):
        ser = DisplaySettingsSerializer(
            DisplaySettings.load(), data=request.data, partial=True
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        # tell the board to reload its media zone live
        realtime.broadcast([realtime.DISPLAY], "display.settings")
        return Response(ser.data)
