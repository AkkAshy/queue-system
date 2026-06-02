'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

export function Clock() {
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="font-mono text-meta text-ink-300">—:—</span>;

  const time = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(now);

  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-mono text-lead tabular-nums text-paper-100">{time}</span>
      <span className="mt-1 font-mono text-meta tabular-nums text-ink-400">{date}</span>
    </div>
  );
}
