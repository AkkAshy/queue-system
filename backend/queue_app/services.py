"""Queue domain logic: ticket numbering, call-next fairness, transitions.

Kept separate from views so it's unit-testable and reusable by the kiosk,
operator and display endpoints. Mirrors the behaviour of the MSW TicketStore.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from catalog.models import Service, ServiceCategory

from .models import Counter, DailyCounter, OperatorSession, Ticket, TicketStatus


@transaction.atomic
def next_number(category: ServiceCategory) -> str:
    """Next ticket number for a category, e.g. 'A042'. Daily reset per code,
    per hall; concurrency-safe via a row lock on the (hall, code, today) counter."""
    today = timezone.localdate()
    row, _ = DailyCounter.objects.select_for_update().get_or_create(
        hall=category.hall, code=category.code, date=today
    )
    row.last_seq += 1
    row.save(update_fields=["last_seq"])
    return f"{category.code}{row.last_seq:03d}"


def create_ticket(
    *,
    category: ServiceCategory,
    service: Service | None,
    idempotency_key: str,
) -> Ticket:
    """Create a waiting ticket; idempotent on idempotency_key."""
    existing = Ticket.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing
    return Ticket.objects.create(
        number=next_number(category),
        hall=category.hall,
        category=category,
        service=service,
        status=TicketStatus.WAITING,
        idempotency_key=idempotency_key,
    )


def queue_for_counter(counter: Counter) -> list[Ticket]:
    """Waiting tickets whose service is eligible for this counter, oldest first."""
    service_ids = list(counter.services.values_list("id", flat=True))
    return list(
        Ticket.objects.filter(
            status=TicketStatus.WAITING, service_id__in=service_ids
        ).order_by("created_at")
    )


def current_for_counter(counter: Counter) -> Ticket | None:
    """The called/serving ticket of a counter, or None."""
    return (
        Ticket.objects.filter(
            counter=counter,
            status__in=[TicketStatus.CALLED, TicketStatus.SERVING],
        )
        .order_by("-called_at")
        .first()
    )


@transaction.atomic
def call_next(*, counter: Counter, operator_id=None) -> Ticket | None:
    """Call the oldest eligible waiting ticket to this counter."""
    q = queue_for_counter(counter)
    if not q:
        return None
    ticket = Ticket.objects.select_for_update().get(pk=q[0].pk)
    ticket.status = TicketStatus.CALLED
    ticket.counter = counter
    ticket.operator_id = operator_id
    ticket.called_at = timezone.now()
    ticket.save(update_fields=["status", "counter", "operator", "called_at"])
    return ticket


def finish(ticket: Ticket) -> Ticket:
    ticket.status = TicketStatus.SERVED
    ticket.save(update_fields=["status"])
    return ticket


def skip(ticket: Ticket) -> Ticket:
    ticket.status = TicketStatus.SKIPPED
    ticket.save(update_fields=["status"])
    return ticket


def transfer(ticket: Ticket, new_counter: Counter) -> Ticket:
    """Transfer to a new counter; resets to waiting."""
    ticket.status = TicketStatus.WAITING
    ticket.counter = new_counter
    ticket.operator = None
    ticket.called_at = None
    ticket.save(update_fields=["status", "counter", "operator", "called_at"])
    return ticket


def active_calls(limit: int = 12, hall_id=None) -> list[Ticket]:
    """Called/serving tickets, newest call first. Scoped to a hall when given."""
    qs = Ticket.objects.filter(
        status__in=[TicketStatus.CALLED, TicketStatus.SERVING],
        counter__isnull=False,
    )
    if hall_id:
        qs = qs.filter(hall_id=hall_id)
    return list(qs.order_by("-called_at")[:limit])


def waiting_list(limit: int = 20, hall_id=None) -> list[Ticket]:
    """Waiting (issued, not yet called) tickets, oldest first — the queue shown
    on the board. Scoped to a hall when given."""
    qs = Ticket.objects.filter(status=TicketStatus.WAITING)
    if hall_id:
        qs = qs.filter(hall_id=hall_id)
    return list(qs.order_by("created_at")[:limit])


def start_session(*, user, counter: Counter) -> OperatorSession:
    return OperatorSession.objects.create(user=user, counter=counter)


def set_session_status(session: OperatorSession, status: str) -> OperatorSession:
    session.status = status
    if status == OperatorSession.Status.ENDED:
        session.ended_at = timezone.now()
    session.save(update_fields=["status", "ended_at"])
    return session
