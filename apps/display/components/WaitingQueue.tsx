'use client';

import type { DisplayWaiting } from '@queue/types';

/**
 * The waiting queue — issued tickets that haven't been called yet, oldest
 * first. Lets a visitor see their number the moment they take a ticket. The
 * first chip (next up) is accented; the rest are neutral.
 */
export function WaitingQueue({ waiting }: { waiting: DisplayWaiting[] }) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-rxl border border-hair bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-hair px-5 py-2.5">
        <span className="eyebrow">Gezekte · Navbatda</span>
        <span className="eyebrow text-coal-2">{waiting.length}</span>
      </div>

      <div className="flex flex-1 flex-wrap content-start gap-2 overflow-hidden p-4">
        {waiting.length === 0 && (
          <span className="text-coal-3">Gezek bos · Navbat bo'sh</span>
        )}
        {waiting.map((w, i) => (
          <span
            key={w.id}
            className={`rounded-rlg border px-4 py-2 text-2xl font-extrabold tabular-nums ${
              i === 0
                ? 'border-coral bg-coral-soft text-coral-600'
                : 'border-hair-2 bg-cream text-coal'
            }`}
          >
            {w.number}
          </span>
        ))}
      </div>
    </section>
  );
}
