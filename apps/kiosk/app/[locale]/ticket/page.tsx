'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useKioskStore } from '@/store/kiosk-store';

export default function TicketPage() {
  const t = useTranslations('ticket');
  const locale = useLocale();
  const router = useRouter();
  const { ticket, category, reset } = useKioskStore();

  useEffect(() => {
    if (!ticket) router.replace(`/${locale}`);
  }, [ticket, locale, router]);

  if (!ticket || !category) return null;

  const goHome = () => {
    reset();
    router.push(`/${locale}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 p-12">
      <div className="text-kiosk-md text-muted-foreground">{t('title')}</div>
      <div
        className="flex h-[380px] w-[380px] items-center justify-center rounded-[3rem] font-black"
        style={{ backgroundColor: category.color, color: '#0f172a', fontSize: '10rem', lineHeight: 1 }}
      >
        {ticket.number}
      </div>
      <div className="max-w-3xl text-center text-kiosk-md">{t('goTo')}</div>
      <button
        onClick={goHome}
        className="rounded-2xl bg-muted px-12 py-6 text-kiosk-md font-semibold"
      >
        {t('new')}
      </button>
    </main>
  );
}
