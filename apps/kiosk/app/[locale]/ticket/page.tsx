'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useKioskStore } from '@/store/kiosk-store';
import { KioskHeader } from '@/components/KioskHeader';
import { categoryVisual } from '@/lib/category-visual';

export default function TicketPage() {
  const t = useTranslations('ticket');
  const locale = useLocale();
  const router = useRouter();
  const { ticket, category, service, reset } = useKioskStore();

  useEffect(() => {
    if (!ticket) router.replace(`/${locale}`);
  }, [ticket, locale, router]);

  if (!ticket || !category) return null;

  const goHome = () => {
    reset();
    router.push(`/${locale}`);
  };

  const serviceName = service ? (locale === 'ru' ? service.name_ru : service.name_kaa) : null;
  const categoryName = locale === 'ru' ? category.name_ru : category.name_kaa;
  const { text } = categoryVisual(category.code);
  const issuedAt = new Date(ticket.created_at);
  const issuedText = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(issuedAt);

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-10 pb-16">
        <div className="w-full max-w-xl">
          <div className="paper rounded-rxl px-12 pb-12 pt-10">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t('eyebrow')}</span>
              <span className="text-sm text-coal-3">#{ticket.id.slice(0, 8)}</span>
            </div>

            <div className="my-6 border-t border-dashed border-hair-2" />

            <div className="text-center">
              <span className="eyebrow text-coral">{t('title')}</span>
              <div className={`mt-3 text-8xl font-extrabold leading-none tracking-tight ${text}`}>
                {ticket.number}
              </div>
            </div>

            <div className="my-8 border-t border-dashed border-hair-2" />

            <div className="grid grid-cols-2 gap-y-5">
              <div>
                <span className="eyebrow">{locale === 'ru' ? 'Категория' : 'Kategoriya'}</span>
                <div className="mt-1.5 font-semibold text-coal">{categoryName}</div>
              </div>
              <div className="text-right">
                <span className="eyebrow">{t('issued')}</span>
                <div className="mt-1.5 font-medium tabular-nums text-coal">{issuedText}</div>
              </div>
              {serviceName && (
                <div className="col-span-2">
                  <span className="eyebrow">{locale === 'ru' ? 'Услуга' : 'Xızmet'}</span>
                  <div className="mt-1.5 leading-snug text-coal">{serviceName}</div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-8 text-center text-lg text-coal-2">{t('goTo')}</p>

          <div className="mt-6 flex justify-center">
            <button
              onClick={goHome}
              className="rounded-full bg-white px-10 py-4 font-semibold text-coal-2 shadow-soft transition-colors hover:text-coral"
            >
              {t('new')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
