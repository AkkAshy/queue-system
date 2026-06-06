'use client';

import type { DisplayBoardWindow } from '@queue/types';

/**
 * Bottom strip — every active window with its current call (or "—" when idle).
 * Wraps to a second row when there are many windows, so it scales to any
 * counter count without overflowing. A window whose current call is fresh
 * pulses coral.
 */
export function WindowStrip({
  windows,
  freshIds,
}: {
  windows: DisplayBoardWindow[];
  freshIds: Set<string>;
}) {
  return (
    <section className="flex flex-wrap gap-2" style={{ gridColumn: '1 / -1', gridRow: 2 }}>
      {windows.map((w) => {
        const fresh = w.current ? freshIds.has(w.current.id) : false;
        return (
          <div
            key={w.counter_id}
            className={`flex min-w-0 flex-[1_1_calc(12.5%-8px)] flex-col items-center rounded-rlg border bg-card px-2 py-2 text-center shadow-soft transition-colors duration-500 ${
              fresh ? 'animate-board-ring border-coral bg-coral-soft' : 'border-hair'
            }`}
          >
            <span className="whitespace-nowrap text-[0.62rem] font-bold uppercase tracking-wide text-coal-3">
              {w.counter_number}-oyna
            </span>
            <span
              className={`text-[clamp(1.1rem,2.2vw,1.7rem)] font-extrabold tabular-nums ${
                fresh ? 'text-coral-600' : w.current ? 'text-coal' : 'text-coal-3'
              }`}
            >
              {w.current ? w.current.number : '—'}
            </span>
          </div>
        );
      })}
    </section>
  );
}
