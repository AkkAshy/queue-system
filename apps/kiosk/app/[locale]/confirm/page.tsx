'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { Ticket } from '@queue/types';
import { useKioskStore } from '@/store/kiosk-store';
import { printTicket } from '@/lib/printer';

async function createTicket(body: {
  category_id: number;
  service_id: number;
  idempotency_key: string;
}): Promise<Ticket> {
  const res = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('ticket creation failed');
  return res.json();
}

export default function ConfirmPage() {
  const t = useTranslations('confirm');
  const locale = useLocale();
  const router = useRouter();
  const { category, service, prepareIdempotencyKey, setTicket } = useKioskStore();

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async (ticket) => {
      setTicket(ticket);
      const result = await printTicket(ticket);
      if (!result.ok) {
        router.push(`/${locale}/error`);
        return;
      }
      router.push(`/${locale}/ticket`);
    },
    onError: () => router.push(`/${locale}/error`),
  });

  if (!category || !service) {
    if (typeof window !== 'undefined') router.push(`/${locale}`);
    return null;
  }

  const serviceName = locale === 'ru' ? service.name_ru : service.name_kaa;
  const categoryName = locale === 'ru' ? category.name_ru : category.name_kaa;

  const confirm = () => {
    const key = prepareIdempotencyKey();
    mutation.mutate({ category_id: category.id, service_id: service.id, idempotency_key: key });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-12">
      <h1 className="text-kiosk-lg font-bold">{t('title')}</h1>

      <div className="w-full max-w-3xl space-y-6 rounded-3xl border-4 bg-card p-10 text-center"
           style={{ borderColor: category.color }}>
        <div>
          <div className="text-muted-foreground">{t('category')}</div>
          <div className="text-kiosk-md font-semibold">{categoryName}</div>
        </div>
        <div>
          <div className="text-muted-foreground">{t('service')}</div>
          <div className="text-2xl leading-snug">{serviceName}</div>
        </div>
      </div>

      <div className="flex w-full max-w-3xl gap-6">
        <button
          className="flex-1 rounded-2xl bg-muted py-8 text-kiosk-md font-semibold"
          onClick={() => router.push(`/${locale}`)}
          disabled={mutation.isPending}
        >
          {t('cancel')}
        </button>
        <button
          className="flex-1 rounded-2xl py-8 text-kiosk-md font-semibold text-slate-900"
          style={{ backgroundColor: category.color }}
          onClick={confirm}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? '…' : t('getTicket')}
        </button>
      </div>
    </main>
  );
}
