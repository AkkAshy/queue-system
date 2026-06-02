'use client';

import type { DisplayCall } from '@queue/types';
import { accentFor } from '@/lib/category';

interface Props {
  calls: DisplayCall[];
}

export function CallsGrid({ calls }: Props) {
  if (calls.length === 0) return null;

  return (
    <section className="border-t border-ink-700/60 px-12 py-8">
      <div className="mb-5 flex items-baseline justify-between">
        <span className="eyebrow">Aldıngı shaqırıwlar · Предыдущие вызовы</span>
        <span className="font-mono text-meta text-ink-500">{calls.length}</span>
      </div>
      <ul className="grid grid-cols-4 gap-5">
        {calls.slice(0, 8).map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-4 rounded-2xl border border-ink-700 bg-ink-800/40 px-6 py-5"
          >
            <span
              className="h-12 w-1.5 rounded-full"
              style={{ backgroundColor: accentFor(c.number) }}
              aria-hidden
            />
            <div className="flex flex-col leading-none">
              <span className="font-serif text-h3 font-semibold text-paper-100">
                {c.number}
              </span>
              <span className="mt-2 font-mono text-meta text-ink-400">
                Okno №{c.counter_number}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
