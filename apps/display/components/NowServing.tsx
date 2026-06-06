'use client';

import type { DisplayCall } from '@queue/types';

/**
 * "Now serving" panel — the latest calls (number → window), newest first.
 * Never overflows: shows at most `limit` rows regardless of window count.
 * A freshly-called row flashes coral for a few seconds (driven by `freshIds`),
 * then settles to neutral — the colour means "just called", not "topmost".
 */
export function NowServing({
  calls,
  freshIds,
  limit = 5,
}: {
  calls: DisplayCall[];
  freshIds: Set<string>;
  limit?: number;
}) {
  const rows = calls.slice(0, limit);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-rxl border border-hair bg-card shadow-soft">
      <div className="bg-coral px-5 py-3 text-center text-white">
        <div className="text-xl font-extrabold leading-tight">Házir qabıllanbaqta</div>
        <div className="text-xs font-bold uppercase tracking-[0.16em] opacity-90">
          Hozir xizmat ko'rsatilmoqda
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-coal-3">
            Házirshe shaqırıw joq
          </div>
        )}
        {rows.map((c) => {
          const fresh = freshIds.has(c.id);
          return (
            <div
              key={c.id}
              className={`grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-hair px-5 transition-colors duration-500 last:border-b-0 ${
                fresh ? 'bg-coral-soft' : ''
              }`}
            >
              <span
                className={`text-[clamp(2rem,4.4vw,3.5rem)] font-extrabold tabular-nums ${
                  fresh ? 'animate-board-pop text-coral-600' : 'text-coal'
                }`}
              >
                {c.number}
              </span>
              <span className="text-2xl text-coal-3">→</span>
              <span
                className={`min-w-[74px] rounded-rlg border px-4 py-1 text-center text-[clamp(1.3rem,3vw,2.2rem)] font-extrabold tabular-nums ${
                  fresh
                    ? 'border-coral bg-coral text-white'
                    : 'border-hair-2 bg-cream text-coal-2'
                }`}
              >
                №{c.counter_number}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
