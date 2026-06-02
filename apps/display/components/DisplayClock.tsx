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
    return <span className="font-mono text-h3 tabular-nums text-ink-300">—:—</span>;
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
      <span className="font-mono text-h2 font-semibold tabular-nums text-paper-100">
        {time}
      </span>
      <span className="mt-2 font-mono text-meta capitalize tabular-nums text-ink-400">
        {date}
      </span>
    </div>
  );
}
