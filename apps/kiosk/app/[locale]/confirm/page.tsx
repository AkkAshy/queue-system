'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { Hall, Ticket } from '@queue/types';
import { useKioskStore } from '@/store/kiosk-store';
import { printTicket } from '@/lib/printer';
import { KioskHeader } from '@/components/KioskHeader';
import { categoryVisual } from '@/lib/category-visual';

async function fetchHalls(): Promise<Hall[]> {
  const res = await fetch('/api/halls');
  if (!res.ok) return [];
  return res.json();
}

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
  const { category, service, prepareIdempotencyKey, setTicket, setHall, setPrintFailed } =
    useKioskStore();

  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: fetchHalls });
  // The hall is derived from the chosen category — the student never picks it.
  const hall = (halls ?? []).find((h) => h.id === category?.hall_id) ?? null;

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: async (ticket) => {
      // The ticket is already queued (and on the display board) the moment the
      // backend created it. Printing is best-effort: a dead printer must NOT
      // stop the student from getting their number — we just flag it so the
      // ticket page tells them to remember it.
      setTicket(ticket);
      setHall(hall); // so the ticket screen + print show which hall
      const result = await printTicket({ ticket, category: category!, service, hall });
      setPrintFailed(!result.ok);
      router.push(`/${locale}/ticket`);
    },
    // Only a failed ticket creation (backend down) is a hard error — then there
    // is no queue entry to show.
    onError: () => router.push(`/${locale}/error`),
  });

  if (!category || !service) {
    if (typeof window !== 'undefined') router.push(`/${locale}`);
    return null;
  }

  const serviceName = locale === 'ru' ? service.name_ru : service.name_kaa;
  const categoryName = locale === 'ru' ? category.name_ru : category.name_kaa;
  const { Icon, chip } = categoryVisual(category.code);

  const confirm = () => {
    const key = prepareIdempotencyKey();
    mutation.mutate({
      category_id: category.id,
      service_id: service.id,
      idempotency_key: key,
    });
  };

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-10 pb-16">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <span className="eyebrow text-coral">{t('eyebrow')}</span>
            <h1 className="mt-3 text-4xl font-extrabold text-coal">{t('title')}</h1>
          </div>

          <div className="paper rounded-rxl p-8">
            <div className="flex items-center gap-5">
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-rlg ${chip}`}>
                <Icon className="h-8 w-8" strokeWidth={2} />
              </span>
              <div>
                <span className="eyebrow">{t('category')}</span>
                <div className="mt-1 text-xl font-bold text-coal">{categoryName}</div>
              </div>
            </div>

            <div className="my-6 h-px bg-hair" aria-hidden />

            <span className="eyebrow">{t('service')}</span>
            <p className="mt-2 text-lg font-medium leading-snug text-coal">{serviceName}</p>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              className="flex-1 rounded-r border border-hair-2 bg-white py-6 text-lg font-semibold text-coal-2 transition-colors hover:text-coal disabled:opacity-40"
              onClick={() => router.push(`/${locale}`)}
              disabled={mutation.isPending}
            >
              {t('cancel')}
            </button>
            <button
              className="flex-1 rounded-r bg-coral py-6 text-lg font-bold text-white shadow-coral transition-all hover:bg-coral-600 active:translate-y-px disabled:opacity-60"
              onClick={confirm}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t('printing') : t('getTicket')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
