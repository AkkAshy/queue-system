'use client';

import { useCallback, useRef } from 'react';

/**
 * A short two-tone WebAudio chime, played when a new call lands.
 * No audio asset needed — synthesised on the fly. Phase 6+ swaps this for
 * recorded Karakalpak number announcements.
 */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback((muted: boolean) => {
    if (muted) return;
    if (typeof window === 'undefined') return;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    if (!ctxRef.current) ctxRef.current = new Ctor();
    const ctx = ctxRef.current;
    // Resume if the browser suspended it before a user gesture.
    void ctx.resume();

    const now = ctx.currentTime;
    // Two ascending notes: a calm "ding-dong".
    const notes = [
      { freq: 880, start: 0, dur: 0.22 },
      { freq: 1175, start: 0.18, dur: 0.32 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  }, []);
}
