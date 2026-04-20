import { http, HttpResponse } from 'msw';
import categories from './fixtures/categories.json';
import services from './fixtures/services.json';
import { TicketStore } from './ticket-store';
import type { CreateTicketRequest, ServiceCategory } from '@queue/types';

const store = new TicketStore();

export const handlers = [
  http.get('/api/categories', () => HttpResponse.json(categories)),

  http.get('/api/services', ({ request }) => {
    const url = new URL(request.url);
    const cat = url.searchParams.get('category_id');
    const list = cat ? services.filter((s) => s.category_id === Number(cat)) : services;
    return HttpResponse.json(list);
  }),

  http.post('/api/tickets', async ({ request }) => {
    const body = (await request.json()) as CreateTicketRequest;
    const category = (categories as ServiceCategory[]).find((c) => c.id === body.category_id);
    if (!category) return HttpResponse.json({ error: 'unknown category' }, { status: 400 });

    // simulate small latency
    await new Promise((r) => setTimeout(r, 150));

    const ticket = store.create({
      category_id: body.category_id,
      code: category.code,
      service_id: body.service_id,
      idempotency_key: body.idempotency_key,
    });
    return HttpResponse.json(ticket, { status: 201 });
  }),
];
