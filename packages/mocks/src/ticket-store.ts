import type { Ticket } from '@queue/types';

interface CreateArgs {
  category_id: number;
  code: string;          // 'A', 'B', etc.
  service_id?: number;
  idempotency_key: string;
}

interface CallNextArgs {
  counter_id: number;
  operator_id: number;
  service_ids: number[];
}

interface SeedArgs {
  number: string;
  category_id: number;
  service_id: number;
  created_at: string;    // ISO
}

interface SeedCalledArgs {
  number: string;
  category_id: number;
  service_id: number;
  counter_id: number;
  operator_id: number;
  called_at: string;     // ISO
}

export class TicketStore {
  private counters = new Map<string, number>();        // prefix → last number
  private byKey = new Map<string, Ticket>();           // idempotency_key → ticket (kept for Phase 1 compat)
  private byId = new Map<string, Ticket>();            // id → ticket (primary index)

  // -------- Phase 1: create (unchanged behaviour) --------

  create(args: CreateArgs): Ticket {
    const cached = this.byKey.get(args.idempotency_key);
    if (cached) return { ...cached };

    const last = this.counters.get(args.code) ?? 0;
    const next = last + 1;
    this.counters.set(args.code, next);

    const number = `${args.code}${next.toString().padStart(3, '0')}`;
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      number,
      hall_id: 1, // mock catalog all belongs to hall 1
      category_id: args.category_id,
      service_id: args.service_id ?? null,
      status: 'waiting',
      counter_id: null,
      operator_id: null,
      created_at: new Date().toISOString(),
      called_at: null,
    };
    this.byKey.set(args.idempotency_key, ticket);
    this.byId.set(ticket.id, ticket);
    return { ...ticket };
  }

  // -------- Phase 4: queries --------

  list(): Ticket[] {
    return [...this.byId.values()].map((t) => ({ ...t }));
  }

  get(id: string): Ticket | undefined {
    const t = this.byId.get(id);
    return t ? { ...t } : undefined;
  }

  /** The called/serving ticket of a counter, or null. */
  currentForCounter(counterId: number): Ticket | null {
    const t = [...this.byId.values()].find(
      (x) =>
        x.counter_id === counterId && (x.status === 'called' || x.status === 'serving'),
    );
    return t ? { ...t } : null;
  }

  /** All active calls (called or serving) across every counter, newest call first. */
  activeCalls(): Ticket[] {
    return [...this.byId.values()]
      .filter((t) => t.status === 'called' || t.status === 'serving')
      .sort((a, b) => (b.called_at ?? '').localeCompare(a.called_at ?? ''))
      .map((t) => ({ ...t }));
  }

  /** Waiting tickets whose service_id is eligible for this counter, oldest first. */
  queueForCounter(eligibleServiceIds: number[]): Ticket[] {
    const eligible = new Set(eligibleServiceIds);
    return [...this.byId.values()]
      .filter(
        (t) =>
          t.status === 'waiting' &&
          t.service_id !== null &&
          eligible.has(t.service_id),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((t) => ({ ...t }));
  }

  // -------- Phase 4: transitions --------

  callNext(args: CallNextArgs): Ticket | null {
    const q = this.queueForCounter(args.service_ids);
    if (q.length === 0) return null;
    const oldest = q[0]!;
    return this.update(oldest.id, {
      status: 'called',
      counter_id: args.counter_id,
      operator_id: args.operator_id,
      called_at: new Date().toISOString(),
    })!;
  }

  finish(id: string): Ticket | null {
    return this.update(id, { status: 'served' });
  }

  skip(id: string): Ticket | null {
    return this.update(id, { status: 'skipped' });
  }

  /** Transfer to a new counter; resets to waiting. */
  transfer(id: string, newCounterId: number): Ticket | null {
    return this.update(id, {
      status: 'waiting',
      counter_id: newCounterId,
      operator_id: null,
      called_at: null,
    });
  }

  // -------- Phase 4: seed + update primitive --------

  /** Load waiting tickets for demos. Overwrites nothing else. */
  seedWaiting(items: SeedArgs[]): void {
    for (const s of items) {
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        number: s.number,
        hall_id: 1,
        category_id: s.category_id,
        service_id: s.service_id,
        status: 'waiting',
        counter_id: null,
        operator_id: null,
        created_at: s.created_at,
        called_at: null,
      };
      this.byId.set(ticket.id, ticket);
    }
  }

  /** Load already-called tickets for demos (so the display board isn't empty). */
  seedCalled(items: SeedCalledArgs[]): void {
    for (const s of items) {
      const ticket: Ticket = {
        id: crypto.randomUUID(),
        number: s.number,
        hall_id: 1,
        category_id: s.category_id,
        service_id: s.service_id,
        status: 'called',
        counter_id: s.counter_id,
        operator_id: s.operator_id,
        created_at: s.called_at,
        called_at: s.called_at,
      };
      this.byId.set(ticket.id, ticket);
    }
  }

  update(id: string, patch: Partial<Ticket>): Ticket | null {
    const existing = this.byId.get(id);
    if (!existing) return null;
    const updated: Ticket = { ...existing, ...patch };
    this.byId.set(id, updated);
    return { ...updated };
  }

  reset() {
    this.counters.clear();
    this.byKey.clear();
    this.byId.clear();
  }
}
