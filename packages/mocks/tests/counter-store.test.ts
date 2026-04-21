import { describe, it, expect, beforeEach } from 'vitest';
import { CounterStore } from '../src/counter-store';

describe('CounterStore', () => {
  let store: CounterStore;
  beforeEach(() => {
    store = new CounterStore([
      { id: 1, number: '1', name: 'Okno 1', service_ids: [1, 2], is_active: true },
      { id: 2, number: '2', name: 'Okno 2', service_ids: [3], is_active: false },
    ]);
  });

  it('list returns all counters', () => {
    expect(store.list()).toHaveLength(2);
  });

  it('get returns a counter by id or undefined', () => {
    expect(store.get(1)?.name).toBe('Okno 1');
    expect(store.get(999)).toBeUndefined();
  });

  it('create assigns next id and adds to list', () => {
    const c = store.create({ number: '3', name: 'Okno 3', service_ids: [4, 5], is_active: true });
    expect(c.id).toBe(3);
    expect(store.list()).toHaveLength(3);
  });

  it('update mutates fields and returns the new counter', () => {
    const c = store.update(1, { name: 'Renamed', is_active: false });
    expect(c?.name).toBe('Renamed');
    expect(c?.is_active).toBe(false);
    expect(store.get(1)?.name).toBe('Renamed');
  });

  it('update returns undefined for unknown id', () => {
    expect(store.update(999, { name: 'x' })).toBeUndefined();
  });

  it('remove returns true and drops the counter', () => {
    expect(store.remove(1)).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it('remove returns false for unknown id', () => {
    expect(store.remove(999)).toBe(false);
  });
});
