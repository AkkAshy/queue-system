import {
  localizedName,
  type Hall,
  type KioskLocale,
  type Ticket,
  type Service,
  type ServiceCategory,
} from '@queue/types';

export interface PrintResult {
  ok: boolean;
  error?: string;
}

export interface PrintContext {
  ticket: Ticket;
  category: ServiceCategory;
  service: Service | null;
  hall?: Hall | null;
  // The language the visitor used — the ticket is printed in this language only.
  locale?: KioskLocale;
}

/** localStorage key holding the operator-selected printer (hidden settings). */
const PRINTER_KEY = 'ndpi.printer';

function agentBase(): string {
  return process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:8089';
}

/** The printer chosen on the hidden settings page, or '' for the agent default. */
export function getSelectedPrinter(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PRINTER_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persist the operator's printer choice (empty string clears it). */
export function setSelectedPrinter(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (name) window.localStorage.setItem(PRINTER_KEY, name);
    else window.localStorage.removeItem(PRINTER_KEY);
  } catch {
    /* localStorage unavailable — selection just won't persist */
  }
}

export interface PrinterList {
  printers: string[];
  default: string;
}

/** Asks the local agent which printers are installed on this host. */
export async function listPrinters(): Promise<PrinterList> {
  const res = await fetch(`${agentBase()}/printers`, { method: 'GET' });
  if (!res.ok) throw new Error(`agent returned ${res.status}`);
  const json = (await res.json()) as {
    ok?: boolean;
    printers?: string[];
    default?: string;
    error?: string;
  };
  if (!json.ok) throw new Error(json.error ?? 'unknown agent error');
  return { printers: json.printers ?? [], default: json.default ?? '' };
}

/** Low-level: POST a print body to the agent and normalise the result. */
async function sendPrint(body: Record<string, unknown>): Promise<PrintResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(`${agentBase()}/print`, {
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

/**
 * POSTs the ticket to the local Go agent at NEXT_PUBLIC_AGENT_URL
 * (default http://localhost:8089). The agent drives the Xprinter XP-80T
 * via ESC/POS and returns { ok: true } on success. The selected printer
 * (hidden settings page) is sent as printer_name; empty => agent default.
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
    console.log('[mock-printer]', ctx.ticket.number, '→', getSelectedPrinter() || 'default');
    return { ok: true };
  }

  const locale: KioskLocale = ctx.locale ?? 'ru';
  return sendPrint({
    number: ctx.ticket.number,
    // New agent prints in the visitor's language only.
    locale,
    hall_name: ctx.hall ? localizedName(ctx.hall, locale) : '',
    category_name: ctx.category ? localizedName(ctx.category, locale) : '',
    service_name: ctx.service ? localizedName(ctx.service, locale) : '',
    category_code: ctx.category?.code ?? '',
    // Legacy bilingual fields — kept so an OLD agent (not yet updated on the
    // kiosk PC) still prints correctly during the transition.
    hall_name_kaa: ctx.hall?.name_kaa ?? '',
    hall_name_ru: ctx.hall?.name_ru ?? '',
    category_name_kaa: ctx.category?.name_kaa ?? '',
    category_name_ru: ctx.category?.name_ru ?? '',
    service_name_kaa: ctx.service?.name_kaa ?? '',
    service_name_ru: ctx.service?.name_ru ?? '',
    issued_at: ctx.ticket.created_at,
    ticket_id: ctx.ticket.id,
    printer_name: getSelectedPrinter(),
  });
}

/** Prints a small sample ticket so the operator can verify the chosen printer. */
export async function printTest(printerName?: string): Promise<PrintResult> {
  return sendPrint({
    number: 'TEST',
    locale: 'ru',
    category_name: 'Тест печати',
    service_name: 'Проверка принтера',
    category_code: '',
    issued_at: new Date().toISOString(),
    ticket_id: 'test',
    printer_name: printerName ?? getSelectedPrinter(),
  });
}
