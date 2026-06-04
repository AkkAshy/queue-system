'use client';

import { useCallback } from 'react';

/**
 * Russian voice announcement for a call: «Номер A-042, пройдите к окну 3».
 *
 * Uses the browser's built-in speechSynthesis (ru-RU) — works offline if the
 * OS has a Russian voice, no assets, no model, no internet. speechSynthesis
 * queues utterances natively, so simultaneous calls are spoken one after
 * another. (A later pass can swap this for pre-recorded fragment playback for
 * consistent quality — same call site.)
 */

// "A042" → "A-042" so the voice reads the prefix and digits clearly.
function spokenNumber(number: string): string {
  const m = number.match(/^([A-Za-z]+)[-\s]?(\d+)$/);
  return m ? `${m[1]}-${m[2]}` : number;
}

export function useSpeech() {
  return useCallback((number: string, windowNo: string, muted: boolean) => {
    if (muted) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(
      `Номер ${spokenNumber(number)}, пройдите к окну ${windowNo}`,
    );
    u.lang = 'ru-RU';
    u.rate = 0.95;
    const ru = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('ru'));
    if (ru) u.voice = ru;
    synth.speak(u); // native queue serialises overlapping announcements
  }, []);
}

/** Stop any in-progress / queued speech (used when muting). */
export function cancelSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
