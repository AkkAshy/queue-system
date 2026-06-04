'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { KioskLocale } from '@queue/types';
import { intlLocale } from '@/lib/locale';

export function Clock() {
  const locale = useLocale() as KioskLocale;
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="text-base text-coal-3">—:—</span>;

  const time = new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
  }).format(now);

  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-xl font-semibold tabular-nums text-coal">{time}</span>
      <span className="mt-1 text-sm tabular-nums text-coal-3">{date}</span>
    </div>
  );
}
