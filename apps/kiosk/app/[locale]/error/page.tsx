'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useKioskStore } from '@/store/kiosk-store';
import { KioskHeader } from '@/components/KioskHeader';

export default function ErrorPage() {
  const t = useTranslations('error');
  const locale = useLocale();
  const router = useRouter();
  const reset = useKioskStore((s) => s.reset);

  const retry = () => {
    reset();
    router.push(`/${locale}`);
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-fade-top">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-12 pb-16">
        <div className="w-full max-w-xl text-center">
          <svg
            viewBox="0 0 80 80"
            className="mx-auto h-24 w-24 text-brass-500"
            aria-hidden
          >
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <path
              d="M40 22 V46"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="40" cy="56" r="2.5" fill="currentColor" />
          </svg>

          <span className="eyebrow mt-10 block text-brass-500">{t('eyebrow')}</span>
          <h1 className="mt-5 font-serif text-h1 font-normal text-paper-100">
            {t('title')}
          </h1>
          <p className="mt-6 font-sans text-lead text-ink-300">{t('contact')}</p>

          <button
            onClick={retry}
            className="mt-12 rounded-2xl bg-brass-500 px-12 py-6 font-sans text-lead font-semibold text-ink-900 shadow-paper-lift transition-colors duration-200 hover:bg-brass-400"
          >
            {t('retry')}
          </button>
        </div>
      </section>
    </main>
  );
}
