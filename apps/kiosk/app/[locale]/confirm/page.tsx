'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { Ticket } from '@queue/types';
import { useKioskStore } from '@/store/kiosk-store';
import { printTicket } from '@/lib/printer';
import { KioskHeader } from '@/components/KioskHeader';

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
      const result = await printTicket({ ticket, category: category!, service });
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
    mutation.mutate({
      category_id: category.id,
      service_id: service.id,
      idempotency_key: key,
    });
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-fade-top">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-12 pb-16">
        <div className="w-full max-w-3xl">
          <div className="mb-10 text-center">
            <span className="eyebrow text-brass-400">{t('eyebrow')}</span>
            <h1 className="mt-4 font-serif text-h1 font-normal text-paper-100">
              {t('title')}
            </h1>
          </div>

          <div className="card-surface rounded-3xl p-10">
            <span
              className="absolute inset-x-10 top-0 h-[3px] rounded-b-full"
              style={{ backgroundColor: category.color }}
              aria-hidden
            />

            <div className="grid grid-cols-[auto_1fr] gap-x-10 gap-y-8">
              <span
                className="font-serif text-display leading-none"
                style={{ color: category.color, fontWeight: 400 }}
              >
                {category.code}
              </span>
              <div className="flex flex-col justify-center">
                <span className="eyebrow">{t('category')}</span>
                <span className="mt-3 font-serif text-h3 font-normal leading-tight text-paper-100">
                  {categoryName}
                </span>
              </div>

              <div className="col-span-2 h-px bg-ink-700" aria-hidden />

              <span className="eyebrow col-span-2">{t('service')}</span>
              <p className="col-span-2 -mt-6 font-sans text-lead leading-snug text-paper-100">
                {serviceName}
              </p>
            </div>
          </div>

          <div className="mt-10 flex gap-5">
            <button
              className="flex-1 rounded-2xl border border-ink-700 bg-ink-800/60 py-7 font-sans text-lead font-medium text-ink-300 transition-all duration-200 hover:border-ink-600 hover:text-paper-100 disabled:opacity-40"
              onClick={() => router.push(`/${locale}`)}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </button>
            <button
              className="group relative flex-1 overflow-hidden rounded-2xl bg-brass-500 py-7 font-sans text-lead font-semibold text-ink-900 shadow-paper-lift transition-all duration-200 hover:bg-brass-400 active:translate-y-[1px] disabled:opacity-60"
              onClick={confirm}
              disabled={mutation.isPending}
            >
              <span className="relative z-10">
                {mutation.isPending ? t('printing') : t('getTicket')}
              </span>
              {mutation.isPending && (
                <span className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-ink-900/20" />
              )}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
