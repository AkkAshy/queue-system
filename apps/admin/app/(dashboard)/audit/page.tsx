'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_label: string;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  created_at: string;
}

const ACTIONS = [
  { value: '', label: 'Все действия' },
  { value: 'ticket.called', label: 'Вызов' },
  { value: 'ticket.recalled', label: 'Повтор' },
  { value: 'ticket.finished', label: 'Завершение' },
  { value: 'ticket.skipped', label: 'Пропуск' },
  { value: 'ticket.transferred', label: 'Перевод' },
  { value: 'counter.created', label: 'Окно создано' },
  { value: 'counter.updated', label: 'Окно изменено' },
  { value: 'counter.deleted', label: 'Окно удалено' },
  { value: 'auth.login', label: 'Вход' },
];

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((a) => a.value).map((a) => [a.value, a.label]),
);

async function fetchAudit(action: string): Promise<AuditEntry[]> {
  const res = await fetch(`/api/audit${action ? `?action=${action}` : ''}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function AuditPage() {
  const [action, setAction] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: () => fetchAudit(action),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">Журнал</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Аудит действий</h1>
          <p className="mt-1 text-sm text-coal-3">{data.length} записей</p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-hair-2 bg-white px-3 py-2 text-sm text-coal"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-2xl border border-hair bg-white/40 p-6">
        {isLoading ? (
          <div className="text-sm text-coal-3">Загрузка…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-coal-3">Записей нет</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Время</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Кто</th>
                <th>Детали</th>
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
                      {ACTION_LABEL[e.action] ?? e.action}
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
