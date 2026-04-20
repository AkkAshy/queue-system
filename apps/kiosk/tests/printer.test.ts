import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printTicket } from '@/lib/printer';
import type { Ticket } from '@queue/types';

const sampleTicket: Ticket = {
  id: 't1',
  number: 'A042',
  category_id: 1,
  service_id: 5,
  status: 'waiting',
  counter_id: null,
  created_at: new Date().toISOString(),
};

describe('printTicket (mock)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves with ok: true after delay', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const promise = printTicket(sampleTicket);
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith('[mock-printer]', 'A042');
    logSpy.mockRestore();
  });

  it('returns ok: false when FORCE_PRINTER_FAIL is set', async () => {
    process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL = '1';
    const promise = printTicket(sampleTicket);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.ok).toBe(false);
    delete process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL;
  });
});
