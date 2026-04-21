import type { Counter } from '@queue/types';

export class CounterStore {
  // Internal array — never exposed directly to protect state
  private items: Counter[];
  private nextId: number;

  constructor(initial: Counter[]) {
    // Deep-copy seed data so constructor arg mutations can't affect us
    this.items = initial.map((c) => ({ ...c, service_ids: [...c.service_ids] }));
    this.nextId = (this.items.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
  }

  /** Returns a shallow copy of every counter (callers can't mutate internal state). */
  list(): Counter[] {
    return this.items.map((c) => ({ ...c, service_ids: [...c.service_ids] }));
  }

  /** Returns a copy of the counter with the given id, or undefined. */
  get(id: number): Counter | undefined {
    const c = this.items.find((x) => x.id === id);
    return c ? { ...c, service_ids: [...c.service_ids] } : undefined;
  }

  /** Creates a new counter with an auto-incremented id and returns a copy. */
  create(input: Omit<Counter, 'id'>): Counter {
    const c: Counter = { ...input, service_ids: [...input.service_ids], id: this.nextId++ };
    this.items.push(c);
    return { ...c, service_ids: [...c.service_ids] };
  }

  /** Merges patch into the counter and returns a copy, or undefined if not found. */
  update(id: number, patch: Partial<Omit<Counter, 'id'>>): Counter | undefined {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return undefined;
    const existing = this.items[idx]!;
    const updated: Counter = { ...existing, ...patch };
    // Ensure service_ids is always a fresh array in the internal store too
    if (patch.service_ids) updated.service_ids = [...patch.service_ids];
    this.items[idx] = updated;
    return { ...updated, service_ids: [...updated.service_ids] };
  }

  /** Removes the counter with the given id. Returns true if found, false otherwise. */
  remove(id: number): boolean {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }
}
