'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  DashboardMetrics,
  HourlyLoadPoint,
  RecentTicket,
} from '@queue/types';
import { StatCard } from '@/components/StatCard';
import { HourlyLoadChart } from '@/components/HourlyLoadChart';
import { Badge } from '@/components/ui/badge';

interface DashboardResp {
  metrics: DashboardMetrics;
  hourly: HourlyLoadPoint[];
  recent: RecentTicket[];
}

async function fetchDashboard(): Promise<DashboardResp> {
  const res = await fetch('/api/dashboard');
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
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow text-brass-500">Обзор</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Сегодня в офисе регистратора
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-ink-400">Загрузка…</div>
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

          <section className="rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">Последние талоны</span>
              <span className="text-xs text-ink-400">{data.recent.length} записей</span>
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
                    <td className="font-mono font-semibold text-brass-400">{t.number}</td>
                    <td className="text-ink-300">{t.category_code}</td>
                    <td className="max-w-[340px] truncate text-paper-100">{t.service_name}</td>
                    <td className="font-mono text-ink-300">{t.counter_number ?? '—'}</td>
                    <td>
                      <Badge variant="outline" className="border-ink-600 text-ink-300">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs text-ink-400">
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
