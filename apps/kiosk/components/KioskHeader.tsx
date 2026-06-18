'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Clock } from './Clock';
import { LocaleSwitcher } from './LocaleSwitcher';

// Hidden maintenance gesture: 5 quick taps on the monogram (within 2s) opens
// the printer settings page. Invisible to the public, reachable by the operator.
const TAPS_TO_OPEN = 5;
const TAP_WINDOW_MS = 2000;

export function KioskHeader() {
  const t = useTranslations('institution');
  const router = useRouter();
  const locale = useLocale();
  const taps = useRef<number[]>([]);

  const onMonogramTap = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((ts) => now - ts < TAP_WINDOW_MS);
    if (taps.current.length >= TAPS_TO_OPEN) {
      taps.current = [];
      router.push(`/${locale}/settings`);
    }
  };

  return (
    <header className="flex items-center justify-between gap-8 border-b border-hair bg-card px-10 py-5">
      <div className="flex items-center gap-4">
        {/* coral monogram chip — doubles as the hidden settings gesture */}
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={onMonogramTap}
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-soft"
        >
          {/* NMPI crest — white disc so the dark-blue logo reads on the dark theme */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="NMPI" className="h-full w-full object-contain p-1" />
        </button>
        <div className="flex flex-col leading-tight">
          <span className="text-2xl font-bold text-coal">{t('name')}</span>
          <span className="text-base text-coal-2">{t('office')}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Clock />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
