'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChime } from '@/lib/useChime';
import { useRealtime } from '@/lib/useRealtime';
import { Hero } from '@/components/Hero';
import { CallsGrid } from '@/components/CallsGrid';
import { Ticker } from '@/components/Ticker';
import { DisplayClock } from '@/components/DisplayClock';
import { MuteButton } from '@/components/MuteButton';

const TICKER_ITEMS = [
  'Talonıńızdı joǵaltpań — nómer ekranда kórsetiledi',
  'Сохраняйте талон до вызова',
  'Shaqırıw boyınsha kórsetilgen aynaǵa barıń',
  'NDPI · Registrator ofisi',
];

export default function Page() {
  const playChime = useChime();
  const [muted, setMuted] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);

  // Restore mute preference once on mount.
  useEffect(() => {
    setMuted(localStorage.getItem('display-muted') === '1');
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('display-muted', next ? '1' : '0');
      return next;
    });
  };

  // Realtime: a call/finish on the backend pushes a WS event → instant refetch.
  // Polling stays as the fallback when the socket is down (or in mock mode).
  useRealtime('/ws/display', [['display-active']]);

  const calls = useQuery({
    queryKey: ['display-active'],
    queryFn: api.getActiveCalls,
    refetchInterval: 2000,
    // The board is an always-on TV; keep polling even when the OS/browser
    // reports the tab as hidden (kiosk shells often do).
    refetchIntervalInBackground: true,
  });

  const list = calls.data ?? [];

  // Chime when a call id appears that wasn't present on the previous tick.
  // The very first load only seeds the baseline (no chime for pre-existing calls).
  useEffect(() => {
    if (!calls.data) return;
    const ids = new Set(calls.data.map((c) => c.id));
    if (seenIds.current === null) {
      seenIds.current = ids;
      return;
    }
    const hasNew = calls.data.some((c) => !seenIds.current!.has(c.id));
    seenIds.current = ids;
    if (hasNew) playChime(muted);
  }, [calls.data, muted, playChime]);

  const hero = list[0] ?? null;
  const rest = list.slice(1);

  return (
    <main className="flex h-screen w-screen flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-hair bg-white px-12 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-r bg-coral text-lg font-bold text-white shadow-coral">
            NP
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold text-coal">Ájiniyaz atındaǵı NMPI</span>
            <span className="text-base text-coal-2">Registrator ofisi · Gezek tablosı</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <DisplayClock />
          <MuteButton muted={muted} onToggle={toggleMute} />
        </div>
      </header>

      <Hero call={hero} />

      <CallsGrid calls={rest} />

      <Ticker items={TICKER_ITEMS} />
    </main>
  );
}
