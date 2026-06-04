'use client';

import { useMemo } from 'react';
import type { Service, Ticket } from '@queue/types';
import { useTr } from '@/lib/i18n';

interface Props {
  queue: Ticket[];
  services: Service[];
}

function waitMinutes(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

export function QueueList({ queue, services }: Props) {
  const tr = useTr();
  const byId = useMemo(() => {
    const m = new Map<number, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const first = queue.slice(0, 5);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">{tr('Navbat', 'Nóbet')}</span>
        <span className="text-[11px] text-coal-3">{queue.length}</span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {first.length === 0 ? (
          <li className="text-xs text-coal-3">{tr('Bo\'sh.', 'Bos.')}</li>
        ) : (
          first.map((t, i) => {
            const svc = t.service_id != null ? byId.get(t.service_id) : null;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-rsm bg-white px-3 py-2 shadow-soft"
              >
                <span
                  className={
                    'text-sm font-bold ' + (i === 0 ? 'text-coral' : 'text-coal')
                  }
                >
                  {t.number}
                </span>
                <span className="flex-1 truncate text-[11px] text-coal-2">
                  {svc ? svc.name_ru : '—'}
                </span>
                <span className="text-[10px] text-coal-3">
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
