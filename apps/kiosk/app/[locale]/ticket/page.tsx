'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useKioskStore } from '@/store/kiosk-store';
import { KioskHeader } from '@/components/KioskHeader';

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

  const serviceName = service
    ? locale === 'ru'
      ? service.name_ru
      : service.name_kaa
    : null;

  const categoryName = locale === 'ru' ? category.name_ru : category.name_kaa;
  const issuedAt = new Date(ticket.created_at);
  const issuedText = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(issuedAt);

  return (
    <main className="relative flex min-h-screen flex-col bg-fade-top">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-12 pb-16">
        <div className="w-full max-w-2xl">
          {/* Museum-stub paper card */}
          <div className="paper-card rounded-4xl px-14 pt-10 pb-12">
            <div className="flex items-center justify-between">
              <div className="flex flex-col leading-none">
                <span
                  className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-500"
                >
                  {t('eyebrow')}
                </span>
                <span className="mt-2 font-mono text-meta text-ink-600">
                  {ticket.id.slice(0, 8)}
                </span>
              </div>
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: category.color }}
                aria-hidden
              />
            </div>

            <div
              className="mt-6 border-t border-dashed"
              style={{ borderColor: 'rgba(27,25,24,0.18)' }}
            />

            <div className="mt-10 text-center">
              <span className="eyebrow" style={{ color: '#5C574F' }}>
                {t('title')}
              </span>
              <div
                className="mt-4 font-serif text-ticket font-normal leading-none text-ink-900"
                style={{ fontVariationSettings: "'opsz' 60" }}
              >
                {ticket.number}
              </div>
            </div>

            <div
              className="mt-10 border-t border-dashed"
              style={{ borderColor: 'rgba(27,25,24,0.18)' }}
            />

            <div className="mt-8 grid grid-cols-2 gap-y-4 text-left">
              <div>
                <span className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-500">
                  {locale === 'ru' ? 'Категория' : 'Kategoriya'}
                </span>
                <div className="mt-2 font-serif text-lead font-normal text-ink-900">
                  {categoryName}
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-500">
                  {t('issued')}
                </span>
                <div className="mt-2 font-mono text-meta tabular-nums text-ink-900">
                  {issuedText}
                </div>
              </div>
              {serviceName && (
                <div className="col-span-2">
                  <span className="font-mono text-eyebrow uppercase tracking-[0.22em] text-ink-500">
                    {locale === 'ru' ? 'Услуга' : 'Xızmet'}
                  </span>
                  <div className="mt-2 font-sans text-body leading-snug text-ink-900">
                    {serviceName}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-10 text-center font-sans text-lead text-ink-300">
            {t('goTo')}
          </p>

          <div className="mt-8 flex justify-center">
            <button
              onClick={goHome}
              className="rounded-full border border-ink-700 px-10 py-4 font-sans text-meta font-medium uppercase tracking-[0.15em] text-ink-300 transition-colors duration-200 hover:border-brass-500 hover:text-brass-400"
            >
              {t('new')}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
