'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useKioskStore } from '@/store/kiosk-store';

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-12">
      <div className="text-[8rem]">⚠</div>
      <h1 className="text-kiosk-lg font-bold text-red-400">{t('title')}</h1>
      <p className="text-kiosk-md text-muted-foreground">{t('contact')}</p>
      <button
        onClick={retry}
        className="rounded-2xl bg-primary px-12 py-6 text-kiosk-md font-semibold text-primary-foreground"
      >
        {t('retry')}
      </button>
    </main>
  );
}
