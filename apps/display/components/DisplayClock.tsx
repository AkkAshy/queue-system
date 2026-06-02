'use client';

import { useEffect, useState } from 'react';

export function DisplayClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <span className="text-3xl tabular-nums text-coal-3">—:—</span>;
  }

  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(now);

  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-4xl font-bold tabular-nums text-coal">{time}</span>
      <span className="mt-1.5 text-base capitalize tabular-nums text-coal-3">{date}</span>
    </div>
  );
}
