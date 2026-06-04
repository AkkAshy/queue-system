'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type {
  DashboardMetrics,
  HourlyLoadPoint,
  Hall,
  RecentTicket,
} from '@queue/types';
import { StatCard } from '@/components/StatCard';
import { HourlyLoadChart } from '@/components/HourlyLoadChart';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/lib/useRealtime';

interface DashboardResp {
  metrics: DashboardMetrics;
  hourly: HourlyLoadPoint[];
  recent: RecentTicket[];
}

interface Stats {
  issued: number;
  served: number;
  skipped: number;
  avg_wait_minutes: number;
  avg_service_minutes: number;
  peak_hour: number | null;
}

async function fetchDashboard(): Promise<DashboardResp> {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

async function fetchHalls(): Promise<Hall[]> {
  const res = await fetch('/api/halls');
  return res.ok ? res.json() : [];
}

async function fetchStats(hall: string): Promise<Stats> {
  const q = hall ? `?hall=${hall}` : '';
  const res = await fetch(`/api/stats${q}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

const STATUS_LABEL: Record<string, string> = {
  waiting:   'ожидает',
  called:    'вызван',
  serving:   'обслуживается',
  served:    'обслужен',
  skipped:   'пропущен',
  cancelled: 'отменён',
};

export default function DashboardPage() {
  // Realtime: ticket created/finished pushes a WS event → live metrics refresh.
  useRealtime('/ws/admin', [['dashboard'], ['stats']]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  const [hall, setHall] = useState('');
  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: fetchHalls });
  const { data: stats } = useQuery({
    queryKey: ['stats', hall],
    queryFn: () => fetchStats(hall),
  });
  const exportHref = `/api/stats/export${hall ? `?hall=${hall}` : ''}`;

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow text-coral">Обзор</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Сегодня в офисе регистратора
        </h1>
      </div>

      {/* Статистика по залам (richer metrics + CSV export) */}
      <section className="rounded-2xl border border-hair bg-white/40 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="eyebrow">Статистика</span>
          <div className="flex items-center gap-2">
            <select
              value={hall}
              onChange={(e) => setHall(e.target.value)}
              className="rounded-lg border border-hair-2 bg-white px-3 py-1.5 text-sm text-coal"
            >
              <option value="">Все залы</option>
              {(halls ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name_ru}
                </option>
              ))}
            </select>
            <a
              href={exportHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-sm font-semibold text-cream hover:bg-coral-600"
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-5">
          <StatCard eyebrow="Выдано" value={stats?.issued ?? 0} />
          <StatCard eyebrow="Обслужено" value={stats?.served ?? 0} />
          <StatCard eyebrow="Пропущено" value={stats?.skipped ?? 0} />
          <StatCard eyebrow="Ср. обслуживание" value={stats?.avg_service_minutes ?? 0} unit="мин" />
          <StatCard
            eyebrow="Час пик"
            value={stats?.peak_hour != null ? `${stats.peak_hour}:00` : '—'}
          />
        </div>
      </section>

      {isLoading || !data ? (
        <div className="text-sm text-coal-3">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard eyebrow="Талонов выдано" value={data.metrics.ticketsToday} />
            <StatCard
              eyebrow="Среднее ожидание"
              value={data.metrics.avgWaitMinutes}
              unit="мин"
            />
            <StatCard
              eyebrow="Активных окон"
              value={data.metrics.activeCounters}
              unit="/ 5"
            />
            <StatCard
              eyebrow="Обслужено"
              value={data.metrics.served}
              hint={`${Math.round((data.metrics.served / data.metrics.ticketsToday) * 100)}% от общего`}
            />
          </div>

          <HourlyLoadChart data={data.hourly} />

          <section className="rounded-2xl border border-hair bg-white/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">Последние талоны</span>
              <span className="text-xs text-coal-3">{data.recent.length} записей</span>
            </div>
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Категория</th>
                  <th>Услуга</th>
                  <th>Окно</th>
                  <th>Статус</th>
                  <th>Время</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono font-semibold text-coral-600">{t.number}</td>
                    <td className="text-coal-2">{t.category_code}</td>
                    <td className="max-w-[340px] truncate text-coal">{t.service_name}</td>
                    <td className="font-mono text-coal-2">{t.counter_number ?? '—'}</td>
                    <td>
                      <Badge variant="outline" className="border-hair-2 text-coal-2">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs text-coal-3">
                      {new Date(t.issued_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
