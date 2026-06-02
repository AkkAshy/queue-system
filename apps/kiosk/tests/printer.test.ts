import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printTicket } from '@/lib/printer';
import type { Ticket, ServiceCategory, Service } from '@queue/types';

const sampleTicket: Ticket = {
  id: 't1',
  number: 'A042',
  category_id: 1,
  service_id: 5,
  status: 'waiting',
  counter_id: null,
  operator_id: null,
  created_at: new Date('2026-04-20T14:30:00Z').toISOString(),
  called_at: null,
};

const sampleCategory: ServiceCategory = {
  id: 1,
  code: 'A',
  name_kaa: 'Akademiyalıq iskerlik',
  name_ru: 'Академическая деятельность',
  color: '#7A8FA3',
  order: 1,
};

const sampleService: Service = {
  id: 5,
  category_id: 1,
  name_kaa: 'Test xızmet',
  name_ru: 'Тестовая услуга',
  sla_days: 0,
  delivery_type: 'electron',
  requires_visit: true,
  is_active: true,
};

const ctx = { ticket: sampleTicket, category: sampleCategory, service: sampleService };

describe('printTicket', () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    // Each test installs its own stub
    globalThis.fetch = vi.fn() as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    delete process.env.NEXT_PUBLIC_PRINTER_MOCK;
    delete process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL;
    vi.restoreAllMocks();
  });

  it('succeeds when the agent returns ok:true', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, number: 'A042' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await printTicket(ctx);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/print');
    expect(init!.method).toBe('POST');
    const body = JSON.parse(init!.body as string);
    expect(body.number).toBe('A042');
    expect(body.category_code).toBe('A');
    expect(body.ticket_id).toBe('t1');
  });

  it('fails when the agent returns an error payload', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'offline' }), {
        status: 200,
      }),
    );
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('offline');
  });

  it('fails when the agent returns non-2xx', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('502');
  });

  it('fails when fetch itself throws (agent down)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('respects FORCE_PRINTER_FAIL without touching fetch', async () => {
    process.env.NEXT_PUBLIC_FORCE_PRINTER_FAIL = '1';
    const result = await printTicket(ctx);
    expect(result.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('respects PRINTER_MOCK without touching fetch', async () => {
    process.env.NEXT_PUBLIC_PRINTER_MOCK = '1';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await printTicket(ctx);
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[mock-printer]', 'A042');
  });

  it('still works when called with a bare Ticket (backward compat)', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await printTicket(sampleTicket);
    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.number).toBe('A042');
    expect(body.category_code).toBe(''); // no category provided
  });
});
