'use client';

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Service, Ticket } from '@queue/types';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { useTr } from '@/lib/i18n';

interface Props {
  queue: Ticket[];
  services: Service[];
  current: Ticket | null;   // a ticket in progress blocks new calls
  onBreak: boolean;
}

function waitMinutes(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

export function QueueList({ queue, services, current, onBreak }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const counterId = useOperatorStore((s) => s.counterId);
  const userId = useOperatorStore((s) => s.userId);

  const byId = useMemo(() => {
    const m = new Map<number, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  // Tap any waiting ticket to call THAT client (not just the oldest).
  const call = useMutation({
    mutationFn: (ticketId: string) => {
      if (!counterId || !userId) throw new Error('not signed in');
      return api.callNext({ counter_id: counterId, operator_id: userId, ticket_id: ticketId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: () => toast.error(tr("Chaqirib bo'lmadi", 'Shaqıra almadı')),
  });

  // Can't pull a new client while serving one, on break, or mid-request.
  const blocked = !!current || onBreak || call.isPending;

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">{tr('Navbat', 'Nóbet')}</span>
        <span className="text-[11px] text-coal-3">{queue.length}</span>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {queue.length === 0 ? (
          <li className="text-xs text-coal-3">{tr("Bo'sh.", 'Bos.')}</li>
        ) : (
          queue.map((t, i) => {
            const svc = t.service_id != null ? byId.get(t.service_id) : null;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => call.mutate(t.id)}
                  title={blocked ? undefined : tr('Chaqirish', 'Shaqırıw')}
                  className="flex w-full items-center gap-3 rounded-rsm bg-card px-3 py-2 text-left shadow-soft transition-all hover:bg-coral-soft active:translate-y-[1px] disabled:opacity-50 disabled:hover:bg-card"
                >
                  <span className={'text-sm font-bold ' + (i === 0 ? 'text-coral' : 'text-coal')}>
                    {t.number}
                  </span>
                  <span className="flex-1 truncate text-[11px] text-coal-2">
                    {svc ? svc.name_ru : '—'}
                  </span>
                  <span className="text-[10px] text-coal-3">{waitMinutes(t.created_at)}′</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
