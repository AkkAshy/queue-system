'use client';

import type { DisplayCall } from '@queue/types';
import { accentFor } from '@/lib/category';

interface Props {
  call: DisplayCall | null;
}

export function Hero({ call }: Props) {
  if (!call) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center">
        <span className="eyebrow">NDPI · Gezek</span>
        <p className="mt-6 font-serif text-h2 text-ink-500">Házirshe shaqırıw joq</p>
      </section>
    );
  }

  const accent = accentFor(call.number);

  return (
    <section className="flex flex-1 flex-col items-center justify-center">
      <span className="eyebrow text-brass-500">Shaqırıladı · Вызывается</span>

      {/* key on the call id so a new call re-triggers the enter animation */}
      <div key={call.id} className="animate-call-in mt-4 flex flex-col items-center">
        <div
          className="font-serif font-semibold leading-none tracking-tight text-paper-50"
          style={{ fontSize: 'clamp(7rem, 22vw, 18rem)' }}
        >
          {call.number}
        </div>

        <div className="mt-6 flex items-center gap-5">
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <span className="font-mono text-h1 font-medium text-ink-300">→</span>
          <span className="font-mono text-h1 font-bold text-brass-400">
            Okno №{call.counter_number}
          </span>
        </div>
      </div>
    </section>
  );
}
