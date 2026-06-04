'use client';

import { useCallback } from 'react';

/**
 * Uzbek voice announcement for a call: «A, nol to'rt ikki, uchinchi oynaga o'ting».
 *
 * Plays a library of pre-recorded clips (public/voice/uz/*.mp3) in sequence —
 * letter + digit-by-digit + the window phrase. Works fully OFFLINE and doesn't
 * depend on an OS voice pack (unlike speechSynthesis, which has no Uzbek voice
 * on most machines). Decoded through Web Audio and routed through one
 * AudioContext, so it shares the chime's gesture-unlock (kiosk autoplay).
 *
 * If a clip is missing (e.g. a category code outside A–I, or files not deployed),
 * it falls back to browser speechSynthesis for the whole phrase.
 *
 * Calls are QUEUED — overlapping calls are spoken one after another.
 */

const BASE = '/voice/uz';
const LEAD_MS = 550; // let the chime finish before the voice starts

const DIGITS_UZ = ['nol', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const ORD_UZ = ['', 'birinchi', 'ikkinchi', 'uchinchi', "to'rtinchi", 'beshinchi', 'oltinchi', 'yettinchi', 'sakkizinchi', "to'qqizinchi"];

interface Phrase {
  clips: string[]; // ordered clip URLs
  tts: string;     // spoken fallback text
}

function buildPhrase(number: string, counterNumber: string): Phrase {
  const clips: string[] = [];
  const tts: string[] = [];
  const m = number.match(/^([A-Za-z]+)[-\s]?(\d+)$/);
  const prefix = m?.[1];
  const digits = m?.[2];
  if (prefix && digits) {
    const letter = prefix.charAt(0).toUpperCase();
    clips.push(`${BASE}/letter_${letter}.mp3`);
    tts.push(letter);
    for (const d of digits) {
      clips.push(`${BASE}/digit_${d}.mp3`);
      tts.push(DIGITS_UZ[Number(d)] ?? d);
    }
  } else {
    tts.push(number);
  }

  const w = String(counterNumber).trim();
  if (/^[1-9]$/.test(w)) {
    clips.push(`${BASE}/window_${w}.mp3`);
    tts.push(`${ORD_UZ[Number(w)]} oynaga o'ting`);
  } else {
    // unusual window label → no clip; the TTS fallback reads the whole phrase
    clips.length = 0;
    tts.push(`${w}-oynaga o'ting`);
  }

  return { clips, tts: tts.join(' ') };
}

// ---------- shared Web Audio context + buffer cache ----------
let ctx: AudioContext | null = null;
const cache = new Map<string, AudioBuffer | null>(); // url → buffer (null = load failed)

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  void ctx.resume(); // resume after a user gesture (kiosk autoplay)
  return ctx;
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  const c = getCtx();
  if (!c) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`clip ${res.status}`);
    const buf = await c.decodeAudioData(await res.arrayBuffer());
    cache.set(url, buf);
    return buf;
  } catch {
    cache.set(url, null); // remember the miss so we don't refetch
    return null;
  }
}

// ---------- sequential player ----------
let queue: Phrase[] = [];
let running = false;
let currentSrc: AudioBufferSourceNode | null = null;
let leadTimer: ReturnType<typeof setTimeout> | null = null;

function playBuffer(buf: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    const c = getCtx();
    if (!c) { resolve(); return; }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    currentSrc = src;
    src.onended = () => { if (currentSrc === src) currentSrc = null; resolve(); };
    try { src.start(); } catch { resolve(); }
  });
}

function ttsSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'uz-UZ';
    u.rate = 0.95;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith('uz'));
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function playPhrase(p: Phrase): Promise<void> {
  // Try the clip path; if any clip is missing, speak the whole phrase instead.
  if (p.clips.length > 0) {
    const buffers = await Promise.all(p.clips.map(loadBuffer));
    if (buffers.every((b): b is AudioBuffer => b != null)) {
      for (const b of buffers) await playBuffer(b);
      return;
    }
  }
  await ttsSpeak(p.tts);
}

function pump() {
  if (running) return;
  const phrase = queue.shift();
  if (!phrase) return;
  running = true;
  leadTimer = setTimeout(() => {
    playPhrase(phrase).finally(() => {
      running = false;
      pump();
    });
  }, LEAD_MS);
}

export function useSpeech() {
  return useCallback((number: string, counterNumber: string, muted: boolean) => {
    if (muted || typeof window === 'undefined') return;
    queue.push(buildPhrase(number, counterNumber));
    pump();
  }, []);
}

/** Stop any in-progress / queued announcement (used when muting). */
export function cancelSpeech() {
  queue = [];
  running = false;
  if (leadTimer) { clearTimeout(leadTimer); leadTimer = null; }
  if (currentSrc) { try { currentSrc.stop(); } catch { /* already stopped */ } currentSrc = null; }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}
