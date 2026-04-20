import type { Ticket } from '@queue/types';

export interface PrintResult {
  ok: boolean;
  error?: string;
}

/**
 * Mock printer — Phase 1.
 * Phase 2 will replace with fetch('http://localhost:8089/print', ...) to Go agent.
 */
export function printTicket(ticket: Ticket): Promise<PrintResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL === '1') {
        resolve({ ok: false, error: 'forced failure' });
        return;
      }
      console.log('[mock-printer]', ticket.number);
      resolve({ ok: true });
    }, 500);
  });
}
