'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/useRealtime';

/**
 * Mini LED screen next to an operator's window — shows only the number of the
 * call currently at that window, huge. Open on a second monitor / mini-PC:
 *   /led?counter=3        (counter = the counter id)
 * Auto-updates via WS + 2s polling.
 */
export default function LedPage() {
  const [counterId, setCounterId] = useState<string | null>(null);

  useEffect(() => {
    setCounterId(new URLSearchParams(window.location.search).get('counter'));
  }, []);

  useRealtime('/ws/display', [['display-board']]);

  const board = useQuery({
    queryKey: ['display-board', 'led'],
    queryFn: () => api.getBoard(),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const win = (board.data ?? []).find((w) => String(w.counter_id) === counterId);
  const number = win?.current?.number ?? '—';

  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
      <span className="text-[3vw] font-semibold uppercase tracking-[0.3em] text-white/50">
        {win ? `Okno №${win.counter_number}` : 'Okno'}
      </span>
      <div
        className="font-extrabold leading-none tabular-nums"
        style={{ fontSize: 'min(60vh, 40vw)' }}
      >
        {number}
      </div>
    </main>
  );
}
