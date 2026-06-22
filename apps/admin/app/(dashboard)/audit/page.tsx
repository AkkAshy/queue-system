'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTr } from '@/lib/i18n';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_label: string;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  created_at: string;
}

const ACTIONS: { value: string; uz: string; kaa: string }[] = [
  { value: '', uz: 'Barcha amallar', kaa: 'Barlıq ámeller' },
  { value: 'ticket.called', uz: 'Chaqiruv', kaa: 'Shaqırıw' },
  { value: 'ticket.recalled', uz: 'Qayta chaqiruv', kaa: 'Qayta shaqırıw' },
  { value: 'ticket.finished', uz: 'Yakunlash', kaa: 'Tamamlaw' },
  { value: 'ticket.skipped', uz: "O'tkazib yuborish", kaa: 'Ótkizip jiberiw' },
  { value: 'ticket.transferred', uz: 'Boshqa oynaga', kaa: 'Basqa áynege' },
  { value: 'counter.created', uz: 'Oyna yaratildi', kaa: 'Áyne jaratıldı' },
  { value: 'counter.updated', uz: "Oyna o'zgartirildi", kaa: 'Áyne ózgertildi' },
  { value: 'counter.deleted', uz: "Oyna o'chirildi", kaa: 'Áyne óshirildi' },
  { value: 'auth.login', uz: 'Kirish', kaa: 'Kiriw' },
];

const ACTION_LABEL: Record<string, { uz: string; kaa: string }> = Object.fromEntries(
  ACTIONS.filter((a) => a.value).map((a) => [a.value, { uz: a.uz, kaa: a.kaa }]),
);

async function fetchAudit(from: string): Promise<AuditEntry[]> {
  const res = await fetch(`/api/audit${from ? `?from=${encodeURIComponent(from)}` : ''}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

// Период (дни) → ISO-дата начала. 1 = с начала сегодня, N = N суток назад, 0 = всё время.
const PERIODS: { days: number; uz: string; kaa: string }[] = [
  { days: 1, uz: 'Bugun', kaa: 'Búgin' },
  { days: 7, uz: '7 kun', kaa: '7 kún' },
  { days: 30, uz: '30 kun', kaa: '30 kún' },
  { days: 0, uz: 'Hammasi', kaa: 'Hámmesi' },
];

function fromIsoFor(days: number): string {
  if (!days) return '';
  if (days === 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default function AuditPage() {
  const tr = useTr();
  const [days, setDays] = useState(7);
  const fromIso = useMemo(() => fromIsoFor(days), [days]);
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit', days],
    queryFn: () => fetchAudit(fromIso),
  });
  const exportHref = `/api/audit/export${fromIso ? `?from=${encodeURIComponent(fromIso)}` : ''}`;

  const columns = useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        key: 'time',
        accessor: (e) => new Date(e.created_at).getTime(),
        filter: 'text',
        filterValue: (e) =>
          new Date(e.created_at).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
      },
      {
        key: 'action',
        accessor: (e) => e.action,
        filter: 'select',
        options: ACTIONS.filter((a) => a.value).map((a) => ({
          value: a.value,
          label: tr(a.uz, a.kaa),
        })),
      },
      { key: 'target', accessor: (e) => e.target, filter: 'text' },
      { key: 'actor', accessor: (e) => e.actor_label, filter: 'text' },
      { key: 'meta' },
    ],
    [tr],
  );

  const ctl = useTableControls(data, columns);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="eyebrow text-coral">{tr('Jurnal', 'Jurnal')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Amallar auditi', 'Ámeller auditi')}</h1>
          <p className="mt-1 text-sm text-coal-3">{ctl.view.length} {tr('ta yozuv', 'jazıw')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-hair-2 bg-card px-3 py-1.5 text-sm text-coal"
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {tr(p.uz, p.kaa)}
              </option>
            ))}
          </select>
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-cream hover:bg-coral-600"
          >
            <Download className="h-4 w-4" />
            Excel
          </a>
        </div>
      </div>

      <section className="rounded-2xl border border-hair bg-card/40 p-6">
        {isLoading ? (
          <div className="text-sm text-coal-3">{tr('Yuklanmoqda…', 'Júklenbekte…')}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-coal-3">{tr("Yozuvlar yo'q", 'Jazıwlar joq')}</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <Th ctl={ctl} col="time">{tr('Vaqt', 'Waqıt')}</Th>
                <Th ctl={ctl} col="action">{tr('Amal', 'Ámel')}</Th>
                <Th ctl={ctl} col="target">{tr('Obyekt', 'Obyekt')}</Th>
                <Th ctl={ctl} col="actor">{tr('Kim', 'Kim')}</Th>
                <Th ctl={ctl} col="meta">{tr('Tafsilotlar', 'Tápsilatlar')}</Th>
              </tr>
              <FilterRow ctl={ctl} />
            </thead>
            <tbody>
              {ctl.view.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-coal-3">
                    {new Date(e.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <Badge variant="outline" className="border-hair-2 text-coal-2">
                      {(() => {
                        const lbl = ACTION_LABEL[e.action];
                        return lbl ? tr(lbl.uz, lbl.kaa) : e.action;
                      })()}
                    </Badge>
                  </td>
                  <td className="font-mono font-semibold text-coral-600">{e.target || '—'}</td>
                  <td className="text-coal-2">{e.actor_label || '—'}</td>
                  <td className="max-w-[280px] truncate text-xs text-coal-3">
                    {Object.keys(e.meta ?? {}).length
                      ? JSON.stringify(e.meta)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
