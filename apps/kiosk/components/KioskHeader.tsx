'use client';

import { useTranslations } from 'next-intl';
import { Clock } from './Clock';
import { LocaleSwitcher } from './LocaleSwitcher';

export function KioskHeader() {
  const t = useTranslations('institution');

  return (
    <header className="flex items-center justify-between gap-8 border-b border-hair bg-white px-10 py-5">
      <div className="flex items-center gap-4">
        {/* coral monogram chip */}
        <div className="flex h-12 w-12 items-center justify-center rounded-r bg-coral text-base font-bold text-white shadow-coral">
          NP
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold text-coal">{t('name')}</span>
          <span className="text-sm text-coal-2">{t('office')}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Clock />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
