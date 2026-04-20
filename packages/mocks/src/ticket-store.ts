import type { Ticket } from '@queue/types';

interface CreateArgs {
  category_id: number;
  code: string;          // 'A', 'B', etc.
  service_id?: number;
  idempotency_key: string;
}

export class TicketStore {
  private counters = new Map<string, number>();      // code -> last number
  private byKey = new Map<string, Ticket>();         // idempotency_key -> ticket

  create(args: CreateArgs): Ticket {
    const cached = this.byKey.get(args.idempotency_key);
    if (cached) return cached;

    const last = this.counters.get(args.code) ?? 0;
    const next = last + 1;
    this.counters.set(args.code, next);

    const number = `${args.code}${next.toString().padStart(3, '0')}`;
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      number,
      category_id: args.category_id,
      service_id: args.service_id ?? null,
      status: 'waiting',
      counter_id: null,
      created_at: new Date().toISOString(),
    };
    this.byKey.set(args.idempotency_key, ticket);
    return ticket;
  }

  reset() {
    this.counters.clear();
    this.byKey.clear();
  }
}
