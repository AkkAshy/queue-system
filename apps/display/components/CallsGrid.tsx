'use client';

import type { DisplayCall } from '@queue/types';
import { accentFor } from '@/lib/category';

interface Props {
  calls: DisplayCall[];
}

export function CallsGrid({ calls }: Props) {
  if (calls.length === 0) return null;

  return (
    <section className="px-12 py-8">
      <div className="mb-5 flex items-baseline justify-between">
        <span className="eyebrow">Aldıngı shaqırıwlar · Предыдущие вызовы</span>
        <span className="text-base text-coal-3">{calls.length}</span>
      </div>
      <ul className="grid grid-cols-4 gap-5">
        {calls.slice(0, 8).map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-4 rounded-rlg bg-white px-6 py-5 shadow-soft"
          >
            <span
              className="h-12 w-1.5 rounded-full"
              style={{ backgroundColor: accentFor(c.number) }}
              aria-hidden
            />
            <div className="flex flex-col leading-none">
              <span className="text-3xl font-bold text-coal">{c.number}</span>
              <span className="mt-2 text-base text-coal-3">Okno №{c.counter_number}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
