'use client';

import { useCallback } from 'react';
import { getAudioCtx } from './audio';

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

// Prefix the basePath (e.g. /tablo in prod) so the clips resolve under the
// app's mount point — without it the fetch 404s and we fall back to browser TTS.
const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/voice/uz`;
const LEAD_MS = 550; // let the chime finish before the voice starts

// Узбекские количественные числительные 0–100 — число целым словом
// («qirq ikki» = 42), а не по цифрам. Для TTS-фоллбэка когда клипа нет.
const ONES_UZ = ['nol', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"];
const TENS_UZ = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"];
function cardinalUz(n: number): string {
  if (n < 10) return ONES_UZ[n] ?? String(n);
  if (n === 100) return 'yuz';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return (TENS_UZ[t] ?? '') + (o === 0 ? '' : ' ' + ONES_UZ[o]);
}
// Порядковые для окон («beshinchi oynaga keling»).
const ORD_UZ = ['', 'birinchi', 'ikkinchi', 'uchinchi', "to'rtinchi", 'beshinchi', 'oltinchi', 'yettinchi', 'sakkizinchi', "to'qqizinchi", "o'ninchi", "o'n birinchi", "o'n ikkinchi", "o'n uchinchi", "o'n to'rtinchi", "o'n beshinchi", "o'n oltinchi", "o'n yettinchi", "o'n sakkizinchi", "o'n to'qqizinchi", 'yigirmanchi', 'yigirma birinchi', 'yigirma ikkinchi', 'yigirma uchinchi'];

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
    const num = parseInt(digits, 10); // «042» → 42 — число читаем целиком
    clips.push(`${BASE}/letter_${letter}.mp3`);
    tts.push(letter);
    if (num >= 0 && num <= 100) {
      clips.push(`${BASE}/num_${num}.mp3`); // «qirq ikki», а не «to'rt ikki»
    } else {
      clips.length = 0; // вне набора 0–100 → всю фразу читает TTS-фоллбэк
    }
    tts.push(cardinalUz(num));
  } else {
    tts.push(number);
  }

  const w = String(counterNumber).trim();
  if (clips.length > 0 && /^([1-9]|1[0-9]|2[0-3])$/.test(w)) {
    clips.push(`${BASE}/window_${w}.mp3`); // «beshinchi oynaga keling» (lola)
    tts.push(`${ORD_UZ[Number(w)]} oynaga keling`);
  } else {
    // unusual window label → no clip; the TTS fallback reads the whole phrase
    clips.length = 0;
    tts.push(`${ORD_UZ[Number(w)] ?? w} oynaga keling`);
  }

  return { clips, tts: tts.join(' ') };
}

// ---------- shared Web Audio context + buffer cache ----------
const cache = new Map<string, AudioBuffer | null>(); // url → buffer (null = load failed)

function getCtx(): AudioContext | null {
  return getAudioCtx(); // one context shared with the chime; gesture-unlocked
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
let currentSources: AudioBufferSourceNode[] = [];
let leadTimer: ReturnType<typeof setTimeout> | null = null;

// Spacing between clips. Digits get a short breath so "nol to'rt ikki" doesn't
// slur into one blob; the window phrase gets a longer pause so the number is
// clearly separated from "...oynaga o'ting".
const GAP_S = 0.16;
const WINDOW_PAUSE_S = 0.34;
const LEAD_S = 0.06; // tiny offset so the very first clip's onset isn't clipped
const SPEECH_RATE = 0.9; // чуть медленнее (×0.9) — разборчивее для посетителей

// Schedule the whole phrase on the AudioContext clock in one go: each clip
// starts at an absolute time = end-of-previous + gap. Clock-scheduling is
// sample-accurate and gap-stable, unlike chaining src.onended in JS (which
// adds variable latency between clips → the "каша" effect).
function scheduleClips(buffers: AudioBuffer[], clips: string[]): Promise<void> {
  return new Promise((resolve) => {
    const c = getCtx();
    if (!c || buffers.length === 0) { resolve(); return; }
    const sources: AudioBufferSourceNode[] = [];
    let t = c.currentTime + LEAD_S;
    buffers.forEach((buf, i) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = SPEECH_RATE; // немного замедляем
      src.connect(c.destination);
      try { src.start(t); } catch { /* context closed */ }
      sources.push(src);
      // Pause AFTER this clip: longer if the NEXT clip is the window phrase.
      // Real playback is stretched by 1/RATE — account for it so gaps stay stable.
      const nextIsWindow = clips[i + 1]?.includes('/window_') ?? false;
      t += buf.duration / SPEECH_RATE + (nextIsWindow ? WINDOW_PAUSE_S : GAP_S);
    });
    currentSources = sources;
    const last = sources[sources.length - 1];
    if (!last) { resolve(); return; }
    last.onended = () => { resolve(); };
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
      await scheduleClips(buffers, p.clips);
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
  for (const s of currentSources) { try { s.stop(); } catch { /* already stopped */ } }
  currentSources = [];
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}
