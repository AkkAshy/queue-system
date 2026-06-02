'use client';

import { useMemo } from 'react';
import type { Service, Ticket } from '@queue/types';

interface Props {
  queue: Ticket[];
  services: Service[];
}

function waitMinutes(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

export function QueueList({ queue, services }: Props) {
  const byId = useMemo(() => {
    const m = new Map<number, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const first = queue.slice(0, 5);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">Очередь</span>
        <span className="font-mono text-[11px] text-ink-400">
          {queue.length}
        </span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {first.length === 0 ? (
          <li className="text-xs text-ink-500">Пусто.</li>
        ) : (
          first.map((t, i) => {
            const svc = t.service_id != null ? byId.get(t.service_id) : null;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-800/30 px-3 py-2"
              >
                <span
                  className={
                    'font-mono text-sm font-semibold ' +
                    (i === 0 ? 'text-brass-400' : 'text-paper-100')
                  }
                >
                  {t.number}
                </span>
                <span className="flex-1 truncate text-[11px] text-ink-300">
                  {svc ? svc.name_ru : '—'}
                </span>
                <span className="font-mono text-[10px] text-ink-400">
                  {waitMinutes(t.created_at)}′
                </span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
