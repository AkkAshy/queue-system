import { describe, it, expect, beforeEach } from 'vitest';
import { TicketStore } from '../src/ticket-store';

describe('TicketStore', () => {
  let store: TicketStore;
  beforeEach(() => {
    store = new TicketStore();
  });

  it('generates sequential numbers per category prefix', () => {
    expect(store.create({ category_id: 1, code: 'A', idempotency_key: 'k1' }).number).toBe('A001');
    expect(store.create({ category_id: 1, code: 'A', idempotency_key: 'k2' }).number).toBe('A002');
    expect(store.create({ category_id: 5, code: 'E', idempotency_key: 'k3' }).number).toBe('E001');
  });

  it('returns the same ticket for duplicate idempotency key', () => {
    const first = store.create({ category_id: 1, code: 'A', idempotency_key: 'same' });
    const second = store.create({ category_id: 1, code: 'A', idempotency_key: 'same' });
    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);
  });

  it('pads numbers to 3 digits', () => {
    for (let i = 0; i < 9; i++) {
      store.create({ category_id: 1, code: 'A', idempotency_key: `k${i}` });
    }
    const t = store.create({ category_id: 1, code: 'A', idempotency_key: 'k-10' });
    expect(t.number).toBe('A010');
  });
});
