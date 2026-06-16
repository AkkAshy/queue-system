'use client';

/**
 * One shared AudioContext for the whole board — both the chime (synthesised)
 * and the voice clips (decoded mp3) route through it.
 *
 * Why shared: a browser unlocks audio per-AudioContext on a user gesture
 * (autoplay policy). With two separate contexts they can diverge — one gets
 * resumed, the other stays suspended → the board chimes but never speaks
 * (or vice-versa). One context + one global gesture-unlock keeps them in sync:
 * a single tap/click/keypress anywhere unlocks everything for the session.
 */

let ctx: AudioContext | null = null;
let unlockBound = false;

function create(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  // Resume on the first real user gesture. Kiosk pages often start with no
  // interaction, so the context boots "suspended"; one touch flips it to
  // "running" and it stays there for the session.
  if (!unlockBound) {
    unlockBound = true;
    const unlock = () => { void ctx?.resume(); };
    for (const ev of ['pointerdown', 'touchstart', 'keydown', 'click'] as const) {
      window.addEventListener(ev, unlock, { passive: true });
    }
  }
  return ctx;
}

/** The shared context, with a resume() nudge (no-op if already running). */
export function getAudioCtx(): AudioContext | null {
  const c = create();
  if (c) void c.resume();
  return c;
}
