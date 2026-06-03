'use client';

import { useCallback, useRef } from 'react';

/**
 * A short two-tone WebAudio chime, played when a new call lands.
 * No audio asset needed — synthesised on the fly.
 *
 * Calls are QUEUED: when several operators call at the same moment, the chimes
 * play one after another (≈0.65s apart) instead of overlapping into noise.
 * The visuals flash in parallel; only the audio is serialised.
 */
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextAtRef = useRef(0); // earliest start time for the next queued chime

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
    void ctx.resume(); // resume if suspended before a user gesture

    const GAP = 0.65; // spacing between queued chimes
    const start = Math.max(ctx.currentTime, nextAtRef.current);

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
      const t0 = start + n.start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
    nextAtRef.current = start + GAP;
  }, []);
}
