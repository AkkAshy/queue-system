'use client';

import type { HourlyLoadPoint } from '@queue/types';
import { useTr } from '@/lib/i18n';

interface Props {
  data: HourlyLoadPoint[];
}

export function HourlyLoadChart({ data }: Props) {
  const tr = useTr();
  const max = Math.max(...data.map((d) => Math.max(d.issued, d.served)));

  return (
    <div className="rounded-2xl border border-hair bg-card/40 p-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="eyebrow">{tr("Soatlar bo'yicha yuklama", 'Saatlar boyınsha júklem')}</span>
        <div className="flex items-center gap-4 text-xs text-coal-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-coral" /> {tr('berilgan', 'berilgen')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-coal-3" /> {tr("xizmat ko'rsatilgan", 'xızmet kórsetilgen')}
          </span>
        </div>
      </div>

      <div className="flex h-44 gap-2">
        {data.map((d) => (
          <div key={d.hour} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end gap-[3px] min-h-0">
              <div
                className="w-1/2 rounded-t bg-coral/80"
                style={{ height: `${(d.issued / max) * 100}%` }}
                title={tr(`Berilgan: ${d.issued}`, `Berilgen: ${d.issued}`)}
              />
              <div
                className="w-1/2 rounded-t bg-coal-3/70"
                style={{ height: `${(d.served / max) * 100}%` }}
                title={tr(`Xizmat ko'rsatilgan: ${d.served}`, `Xızmet kórsetilgen: ${d.served}`)}
              />
            </div>
            <span className="font-mono text-[11px] text-coal-3">
              {String(d.hour).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
