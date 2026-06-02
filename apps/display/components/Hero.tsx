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
        <p className="mt-6 text-4xl font-semibold text-coal-3">Házirshe shaqırıw joq</p>
      </section>
    );
  }

  const accent = accentFor(call.number);

  return (
    <section className="flex flex-1 flex-col items-center justify-center">
      <span className="eyebrow text-coral">Shaqırıladı · Вызывается</span>

      {/* key on the call id so a new call re-triggers the enter animation */}
      <div key={call.id} className="animate-call-in mt-4 flex flex-col items-center">
        <div
          className="font-extrabold leading-none tracking-tight text-coal"
          style={{ fontSize: 'clamp(7rem, 22vw, 18rem)' }}
        >
          {call.number}
        </div>

        <div className="mt-4 flex items-center gap-5">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
          <span className="text-5xl font-medium text-coal-3">→</span>
          <span className="rounded-full bg-coral px-8 py-3 text-5xl font-bold text-white shadow-coral">
            Okno №{call.counter_number}
          </span>
        </div>
      </div>
    </section>
  );
}
