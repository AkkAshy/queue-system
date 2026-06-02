from django.db.models import Avg, F
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Service, ServiceCategory

from . import services
from .models import Counter, OperatorSession, Ticket, TicketStatus
from .serializers import (
    CounterSerializer,
    CreateTicketSerializer,
    DisplayCallSerializer,
    OperatorSessionSerializer,
    TicketSerializer,
)


# ---------- counters ----------
class CounterListCreateView(generics.ListCreateAPIView):
    queryset = Counter.objects.all()
    serializer_class = CounterSerializer
    pagination_class = None


class CounterDetailView(generics.RetrieveUpdateDestroyAPIView):
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
        return Response(TicketSerializer(ticket).data)


# ---------- display ----------
class DisplayActiveView(APIView):
    def get(self, request):
        calls = services.active_calls(limit=12)
        return Response(DisplayCallSerializer(calls, many=True).data)
