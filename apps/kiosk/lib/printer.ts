import type { Ticket, Service, ServiceCategory } from '@queue/types';

export interface PrintResult {
  ok: boolean;
  error?: string;
}

export interface PrintContext {
  ticket: Ticket;
  category: ServiceCategory;
  service: Service | null;
}

/**
 * POSTs the ticket to the local Go agent at NEXT_PUBLIC_AGENT_URL
 * (default http://localhost:8089). The agent drives the Xprinter XP-80T
 * via ESC/POS and returns { ok: true } on success.
 *
 * For development without a physical printer, set
 *   NEXT_PUBLIC_FORCE_PRINTER_FAIL=1   (always fails — test error flow)
 *   NEXT_PUBLIC_PRINTER_MOCK=1         (always succeeds — no network)
 */
export async function printTicket(
  input: Ticket | PrintContext,
): Promise<PrintResult> {
  if (process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL === '1') {
    return { ok: false, error: 'forced failure' };
  }

  const ctx: PrintContext =
    'ticket' in input
      ? input
      : { ticket: input, category: null as unknown as ServiceCategory, service: null };

  if (process.env.NEXT_PUBLIC_PRINTER_MOCK === '1') {
    // eslint-disable-next-line no-console
    console.log('[mock-printer]', ctx.ticket.number);
    return { ok: true };
  }

  const base = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:8089';

  const body = {
    number: ctx.ticket.number,
    category_code: ctx.category?.code ?? '',
    category_name_kaa: ctx.category?.name_kaa ?? '',
    category_name_ru: ctx.category?.name_ru ?? '',
    service_name_kaa: ctx.service?.name_kaa ?? '',
    service_name_ru: ctx.service?.name_ru ?? '',
    issued_at: ctx.ticket.created_at,
    ticket_id: ctx.ticket.id,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `agent returned ${res.status}` };
    }
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (json.ok) return { ok: true };
    return { ok: false, error: json.error ?? 'unknown agent error' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
