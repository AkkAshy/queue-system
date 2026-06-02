'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
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
    <main className="flex min-h-screen flex-col bg-cream">
      <KioskHeader />

      <section className="flex flex-1 items-center justify-center px-10 pb-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-rxl bg-coral-soft text-coral">
            <AlertTriangle className="h-12 w-12" strokeWidth={2} />
          </span>

          <span className="eyebrow mt-8 block text-coral">{t('eyebrow')}</span>
          <h1 className="mt-4 text-3xl font-extrabold text-coal">{t('title')}</h1>
          <p className="mt-4 text-lg text-coal-2">{t('contact')}</p>

          <button
            onClick={retry}
            className="mt-10 rounded-r bg-coral px-12 py-5 text-lg font-bold text-white shadow-coral transition-colors hover:bg-coral-600"
          >
            {t('retry')}
          </button>
        </div>
      </section>
    </main>
  );
}
