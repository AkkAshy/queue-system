'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChime } from '@/lib/useChime';
import { useSpeech, cancelSpeech } from '@/lib/useSpeech';
import { useRealtime } from '@/lib/useRealtime';
import { MediaZone } from '@/components/MediaZone';
import { NowServing } from '@/components/NowServing';
import { WaitingQueue } from '@/components/WaitingQueue';
import { WindowStrip } from '@/components/WindowStrip';
import { Ticker } from '@/components/Ticker';
import { DisplayClock } from '@/components/DisplayClock';
import { MuteButton } from '@/components/MuteButton';
import { ThemeToggle } from '@/components/ThemeToggle';

const TICKER_ITEMS = [
  'Talonıńızdı joǵaltpań — nómer ekranda kórsetiledi',
  'Talonni chaqiruvgacha saqlang',
  'Shaqırıw boyınsha kórsetilgen aynaǵa barıń',
  'NDPI · Registrator ofisi',
];

// How long a freshly-called ticket flashes coral before settling to neutral.
const FLASH_MS = 4000;

export default function Page() {
  const playChime = useChime();
  const speak = useSpeech();
  const [muted, setMuted] = useState(false);
  const seenCalledAt = useRef<Map<string, string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  // Which hall this board shows — from ?hall= on the URL (null = all halls).
  const [hallId, setHallId] = useState<string | null>(null);

  useEffect(() => {
    setMuted(localStorage.getItem('display-muted') === '1');
    setHallId(new URLSearchParams(window.location.search).get('hall'));
  }, []);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem('display-muted', next ? '1' : '0');
      if (next) cancelSpeech(); // stop any in-progress announcement
      return next;
    });
  };

  // A call/finish on the backend pushes a WS event → instant refetch of all
  // three board queries. Polling is the fallback when the socket is down.
  useRealtime('/ws/display', [
    ['display-active'],
    ['display-board'],
    ['display-waiting'],
    ['display-settings'],
  ]);

  const active = useQuery({
    queryKey: ['display-active', hallId],
    queryFn: () => api.getActiveCalls(hallId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const board = useQuery({
    queryKey: ['display-board', hallId],
    queryFn: () => api.getBoard(hallId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const waiting = useQuery({
    queryKey: ['display-waiting', hallId],
    queryFn: () => api.getWaiting(hallId),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  const settings = useQuery({
    queryKey: ['display-settings'],
    queryFn: api.getSettings,
    refetchInterval: 30_000,
  });

  const calls = active.data ?? [];

  // Detect newly-called tickets → queue a chime per call + flash their rows.
  // First load only seeds the baseline (no chime/flash for pre-existing calls).
  useEffect(() => {
    if (!active.data) return;
    // Track id → called_at so a *recall* (same id, bumped called_at) also counts
    // as fresh and re-announces, not just brand-new calls.
    const seen = seenCalledAt.current;
    const snapshot = new Map(active.data.map((c) => [c.id, c.called_at]));
    if (seen === null) {
      seenCalledAt.current = snapshot;
      return;
    }
    const fresh = active.data.filter((c) => seen.get(c.id) !== c.called_at);
    seenCalledAt.current = snapshot;
    if (fresh.length === 0) return;

    // Visuals flash in parallel; audio (chime + voice) is queued one-by-one.
    const voiceOff = settings.data?.voice_enabled === false;
    fresh.forEach((c) => {
      playChime(muted);
      speak(c.number, c.counter_number, muted || voiceOff);
    });
    setFreshIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((c) => next.add(c.id));
      return next;
    });
    const freshNow = fresh.map((c) => c.id);
    const timer = setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        freshNow.forEach((id) => next.delete(id));
        return next;
      });
    }, FLASH_MS);
    return () => clearTimeout(timer);
  }, [active.data, muted, playChime, speak, settings.data?.voice_enabled]);

  return (
    <main className="flex h-screen w-screen flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-hair bg-card px-12 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-r bg-coral text-lg font-bold text-white shadow-coral">
            NP
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold text-coal">
              {settings.data?.org_name || 'Ájiniyaz atındaǵı NMPI'}
            </span>
            <span className="text-base text-coal-2">Registrator ofisi · Gezek tablosı</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <DisplayClock />
          <MuteButton muted={muted} onToggle={toggleMute} />
          <ThemeToggle className="h-12 w-12" />
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1 gap-4 p-5"
        style={{ gridTemplateColumns: '1.55fr 1fr', gridTemplateRows: '1fr auto' }}
      >
        <MediaZone url={settings.data?.youtube_url} />
        <div className="flex min-h-0 flex-col gap-4" style={{ gridColumn: 2, gridRow: 1 }}>
          <div className="min-h-0 flex-[3]">
            <NowServing calls={calls} freshIds={freshIds} />
          </div>
          <div className="min-h-0 flex-[2]">
            <WaitingQueue waiting={waiting.data ?? []} />
          </div>
        </div>
        <WindowStrip windows={board.data ?? []} freshIds={freshIds} />
      </div>

      <Ticker
        items={
          settings.data?.ticker_text
            ? settings.data.ticker_text.split('\n').filter(Boolean)
            : TICKER_ITEMS
        }
      />
    </main>
  );
}
