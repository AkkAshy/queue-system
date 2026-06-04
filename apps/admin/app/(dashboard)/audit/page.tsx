'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { useTr } from '@/lib/i18n';

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

async function fetchAudit(action: string): Promise<AuditEntry[]> {
  const res = await fetch(`/api/audit${action ? `?action=${action}` : ''}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function AuditPage() {
  const tr = useTr();
  const [action, setAction] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: () => fetchAudit(action),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr('Jurnal', 'Jurnal')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Amallar auditi', 'Ámeller auditi')}</h1>
          <p className="mt-1 text-sm text-coal-3">{data.length} {tr('ta yozuv', 'jazıw')}</p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-hair-2 bg-white px-3 py-2 text-sm text-coal"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {tr(a.uz, a.kaa)}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-2xl border border-hair bg-white/40 p-6">
        {isLoading ? (
          <div className="text-sm text-coal-3">{tr('Yuklanmoqda…', 'Júklenbekte…')}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-coal-3">{tr("Yozuvlar yo'q", 'Jazıwlar joq')}</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>{tr('Vaqt', 'Waqıt')}</th>
                <th>{tr('Amal', 'Ámel')}</th>
                <th>{tr('Obyekt', 'Obyekt')}</th>
                <th>{tr('Kim', 'Kim')}</th>
                <th>{tr('Tafsilotlar', 'Tápsilatlar')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
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
