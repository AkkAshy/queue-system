import pytest

from catalog.models import Service, ServiceCategory
from queue_app import services
from queue_app.models import Counter, OperatorSession, TicketStatus

pytestmark = pytest.mark.django_db


def _category(code="A", order=1):
    return ServiceCategory.objects.create(
        code=code, name_kaa=f"kaa {code}", name_ru=f"ru {code}", color="#7A8FA3", order=order
    )


def _service(category, name="svc"):
    return Service.objects.create(
        category=category, name_kaa=name, name_ru=name,
        sla_days=0, delivery_type="electron", requires_visit=False, is_active=True,
    )


def test_next_number_increments_per_code():
    a = _category("A")
    b = _category("B", order=2)
    assert services.next_number(a) == "A-001"
    assert services.next_number(a) == "A-002"
    assert services.next_number(b) == "B-001"


def test_create_ticket_is_idempotent():
    a = _category("A")
    s = _service(a)
    t1 = services.create_ticket(category=a, service=s, idempotency_key="k1")
    t2 = services.create_ticket(category=a, service=s, idempotency_key="k1")
    assert t1.id == t2.id
    assert t1.number == "A-001"


def test_call_next_picks_oldest_eligible():
    a = _category("A")
    s1 = _service(a, "s1")
    s2 = _service(a, "s2")
    counter = Counter.objects.create(number="3", name="Okno 3")
    counter.services.set([s2])  # only eligible for s2

    t_old = services.create_ticket(category=a, service=s1, idempotency_key="k1")  # not eligible
    t_mid = services.create_ticket(category=a, service=s2, idempotency_key="k2")  # eligible, oldest eligible
    services.create_ticket(category=a, service=s2, idempotency_key="k3")

    called = services.call_next(counter=counter, operator_id=None)
    assert called is not None
    assert called.id == t_mid.id
    assert called.status == TicketStatus.CALLED
    assert called.counter_id == counter.id
    assert called.called_at is not None
    # the non-eligible ticket is untouched
    t_old.refresh_from_db()
    assert t_old.status == TicketStatus.WAITING


def test_call_next_returns_none_when_empty():
    counter = Counter.objects.create(number="9", name="Okno 9")
    assert services.call_next(counter=counter, operator_id=None) is None


def test_finish_skip_transfer_transitions():
    a = _category("A")
    s = _service(a)
    c1 = Counter.objects.create(number="1", name="Okno 1")
    c1.services.set([s])
    c2 = Counter.objects.create(number="2", name="Okno 2")

    services.create_ticket(category=a, service=s, idempotency_key="k1")
    called = services.call_next(counter=c1, operator_id=None)

    moved = services.transfer(called, c2)
    assert moved.status == TicketStatus.WAITING
    assert moved.counter_id == c2.id
    assert moved.called_at is None

    assert services.finish(called).status == TicketStatus.SERVED


def test_active_calls_newest_first():
    a = _category("A")
    s = _service(a)
    c = Counter.objects.create(number="1", name="Okno 1")
    c.services.set([s])
    services.create_ticket(category=a, service=s, idempotency_key="k1")
    services.create_ticket(category=a, service=s, idempotency_key="k2")
    first = services.call_next(counter=c, operator_id=None)
    second = services.call_next(counter=c, operator_id=None)
    calls = services.active_calls()
    assert [t.id for t in calls] == [second.id, first.id]


def test_session_lifecycle():
    c = Counter.objects.create(number="1", name="Okno 1")
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username="op1", password="x")
    sess = services.start_session(user=user, counter=c)
    assert sess.status == OperatorSession.Status.ACTIVE
    ended = services.set_session_status(sess, OperatorSession.Status.ENDED)
    assert ended.status == OperatorSession.Status.ENDED
    assert ended.ended_at is not None
