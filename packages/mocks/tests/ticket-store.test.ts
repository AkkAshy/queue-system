import { describe, it, expect, beforeEach } from 'vitest';
import { TicketStore } from '../src/ticket-store';

function makeStore() {
  const s = new TicketStore();
  // Seed 5 waiting tickets with deterministic timestamps + service assignments.
  // oldest → newest: t1 (service 1), t2 (service 5), t3 (service 1), t4 (service 9), t5 (service 5)
  s.seedWaiting([
    { number: 'A001', category_id: 1, service_id: 1, created_at: '2026-04-20T09:00:00Z' },
    { number: 'E001', category_id: 5, service_id: 5, created_at: '2026-04-20T09:05:00Z' },
    { number: 'A002', category_id: 1, service_id: 1, created_at: '2026-04-20T09:10:00Z' },
    { number: 'I001', category_id: 9, service_id: 9, created_at: '2026-04-20T09:15:00Z' },
    { number: 'E002', category_id: 5, service_id: 5, created_at: '2026-04-20T09:20:00Z' },
  ]);
  return s;
}

describe('TicketStore — query + transitions', () => {
  let store: TicketStore;
  beforeEach(() => {
    store = makeStore();
  });

  it('list returns all seeded tickets', () => {
    expect(store.list()).toHaveLength(5);
  });

  it('callNext picks oldest waiting ticket whose service is eligible', () => {
    const t = store.callNext({
      counter_id: 3,
      operator_id: 2,
      service_ids: [5, 9], // eligible services for this counter
    });
    expect(t).not.toBeNull();
    expect(t!.number).toBe('E001'); // oldest among services 5 + 9 is E001
    expect(t!.status).toBe('called');
    expect(t!.counter_id).toBe(3);
    expect(t!.operator_id).toBe(2);
    expect(t!.called_at).not.toBeNull();
  });

  it('callNext returns null when no eligible waiting ticket exists', () => {
    const t = store.callNext({
      counter_id: 7,
      operator_id: 9,
      service_ids: [999], // unknown service
    });
    expect(t).toBeNull();
  });

  it('callNext does not pick a ticket already called', () => {
    store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] }); // E001
    const second = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] });
    expect(second!.number).toBe('E002'); // next oldest in service 5
  });

  it('finish transitions called → served', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const done = store.finish(called.id)!;
    expect(done.status).toBe('served');
  });

  it('skip transitions called → skipped', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const skipped = store.skip(called.id)!;
    expect(skipped.status).toBe('skipped');
  });

  it('transfer reassigns counter and resets to waiting', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [1] })!;
    const moved = store.transfer(called.id, 4)!;
    expect(moved.counter_id).toBe(4);
    expect(moved.status).toBe('waiting');
    expect(moved.operator_id).toBeNull();
    expect(moved.called_at).toBeNull();
  });

  it('currentForCounter returns the called/serving ticket of that counter', () => {
    store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] });
    const cur = store.currentForCounter(3);
    expect(cur?.number).toBe('E001');
    expect(store.currentForCounter(99)).toBeNull();
  });

  it('queueForCounter returns waiting tickets of eligible services, oldest first', () => {
    const q = store.queueForCounter([5, 9]);
    expect(q.map((t) => t.number)).toEqual(['E001', 'I001', 'E002']);
    expect(q.every((t) => t.status === 'waiting')).toBe(true);
  });

  it('seedCalled inserts called tickets; activeCalls returns them newest-first', () => {
    store.seedCalled([
      { number: 'A001', category_id: 1, service_id: 1, counter_id: 1, operator_id: 2, called_at: '2026-04-20T10:00:00Z' },
      { number: 'E007', category_id: 5, service_id: 31, counter_id: 3, operator_id: 4, called_at: '2026-04-20T10:05:00Z' },
    ]);
    const calls = store.activeCalls();
    expect(calls.map((t) => t.number)).toEqual(['E007', 'A001']); // newest called_at first
    expect(calls.every((t) => t.status === 'called')).toBe(true);
  });

  it('callNext result shows up in activeCalls', () => {
    store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] }); // E001
    const calls = store.activeCalls();
    expect(calls.some((t) => t.number === 'E001')).toBe(true);
  });

  it('finish removes a ticket from activeCalls', () => {
    const called = store.callNext({ counter_id: 3, operator_id: 2, service_ids: [5] })!;
    expect(store.activeCalls().some((t) => t.id === called.id)).toBe(true);
    store.finish(called.id);
    expect(store.activeCalls().some((t) => t.id === called.id)).toBe(false);
  });

  it('create still works (idempotency preserved from Phase 1)', () => {
    const a = store.create({ category_id: 1, code: 'A', idempotency_key: 'k1' });
    const b = store.create({ category_id: 1, code: 'A', idempotency_key: 'k1' });
    expect(a.id).toBe(b.id);
    expect(store.list()).toHaveLength(6); // 5 seeded + 1 created
  });
});
