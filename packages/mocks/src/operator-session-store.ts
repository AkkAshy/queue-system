import type { OperatorSession, OperatorSessionStatus } from '@queue/types';

interface CreateArgs {
  user_id: number;
  counter_id: number;
}

export class OperatorSessionStore {
  private items: OperatorSession[] = [];
  private nextId = 1;

  create(args: CreateArgs): OperatorSession {
    const s: OperatorSession = {
      id: this.nextId++,
      user_id: args.user_id,
      counter_id: args.counter_id,
      status: 'active',
      started_at: new Date().toISOString(),
      ended_at: null,
    };
    this.items.push(s);
    return { ...s };
  }

  list(): OperatorSession[] {
    return this.items.map((s) => ({ ...s }));
  }

  get(id: number): OperatorSession | undefined {
    const s = this.items.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  /** Active (non-ended) session attached to a counter, if any. */
  activeForCounter(counterId: number): OperatorSession | null {
    const s = this.items.find(
      (x) => x.counter_id === counterId && x.status !== 'ended',
    );
    return s ? { ...s } : null;
  }

  updateStatus(id: number, status: OperatorSessionStatus): OperatorSession | null {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const existing = this.items[idx]!;
    const updated: OperatorSession = {
      ...existing,
      status,
      ended_at: status === 'ended' ? new Date().toISOString() : existing.ended_at,
    };
    this.items[idx] = updated;
    return { ...updated };
  }
}
