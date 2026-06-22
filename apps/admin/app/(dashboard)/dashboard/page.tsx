'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, RotateCcw } from 'lucide-react';
import {
  localizedName,
  type DashboardMetrics,
  type HourlyLoadPoint,
  type Hall,
  type RecentTicket,
} from '@queue/types';
import { StatCard } from '@/components/StatCard';
import { HourlyLoadChart } from '@/components/HourlyLoadChart';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/lib/useRealtime';
import { useTr, useLang } from '@/lib/i18n';

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

const STATUS_LABEL: Record<string, { uz: string; kaa: string }> = {
  waiting:   { uz: 'kutmoqda',                  kaa: 'kútpekte' },
  called:    { uz: 'chaqirilgan',               kaa: 'shaqırılǵan' },
  serving:   { uz: "xizmat ko'rsatilmoqda",     kaa: 'xızmet kórsetilmekte' },
  served:    { uz: "xizmat ko'rsatilgan",       kaa: 'xızmet kórsetilgen' },
  skipped:   { uz: "o'tkazib yuborilgan",       kaa: 'ótkizip jiberilgen' },
  cancelled: { uz: 'bekor qilingan',            kaa: 'biykarlanǵan' },
};

export default function DashboardPage() {
  const tr = useTr();
  const { lang } = useLang();
  // Realtime: ticket created/finished pushes a WS event → live metrics refresh.
  useRealtime('/ws/admin', [['dashboard'], ['stats']]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    // Poll fallback so statuses (ожидает → обслужен) refresh without a manual
    // reload even if the WS event is missed.
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const [hall, setHall] = useState('');
  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: fetchHalls });
  const { data: stats } = useQuery({
    queryKey: ['stats', hall],
    queryFn: () => fetchStats(hall),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });
  const exportHref = `/api/stats/export${hall ? `?hall=${hall}` : ''}`;

  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/halls/${hall}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(tr('Navbat tiklandi', 'Nóbet tiklendi'));
    },
    onError: () => toast.error(tr("Tiklab bo'lmadi", 'Tiklap bolmadı')),
  });

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow text-coral">{tr('Boshqaruv paneli', 'Basqarıw paneli')}</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {tr('Bugun Registrator ofisida', 'Búgin Registrator ofisinde')}
        </h1>
      </div>

      {/* Статистика по залам (richer metrics + CSV export) */}
      <section className="rounded-2xl border border-hair bg-card/40 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="eyebrow">{tr('Statistika', 'Statistika')}</span>
          <div className="flex items-center gap-2">
            <select
              value={hall}
              onChange={(e) => setHall(e.target.value)}
              className="rounded-lg border border-hair-2 bg-card px-3 py-1.5 text-sm text-coal"
            >
              <option value="">{tr('Barcha zallar', 'Barlıq zallar')}</option>
              {(halls ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {localizedName(h, lang)}
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
            <button
              onClick={() => {
                if (hall && window.confirm(tr('Shu zal navbatini tiklaysizmi?', 'Usı zal nóbetin tiklewdi qálaysız ba?'))) reset.mutate();
              }}
              disabled={!hall || reset.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hair-2 bg-card px-3 py-1.5 text-sm font-semibold text-coal-2 hover:text-coral disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              {tr('Tiklash', 'Tiklew')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-5">
          <StatCard eyebrow={tr('Berilgan', 'Berilgen')} value={stats?.issued ?? 0} />
          <StatCard eyebrow={tr("Xizmat ko'rsatilgan", 'Xızmet kórsetilgen')} value={stats?.served ?? 0} />
          <StatCard eyebrow={tr("O'tkazib yuborilgan", 'Ótkizip jiberilgen')} value={stats?.skipped ?? 0} />
          <StatCard eyebrow={tr("O'rt. xizmat", 'Ortasha xızmet')} value={stats?.avg_service_minutes ?? 0} unit={tr('daq', 'min')} />
          <StatCard
            eyebrow={tr('Eng yuqori soat', 'Eń joqarı saat')}
            value={stats?.peak_hour != null ? `${stats.peak_hour}:00` : '—'}
          />
        </div>
      </section>

      {isLoading || !data ? (
        <div className="text-sm text-coal-3">{tr('Yuklanmoqda…', 'Júklenbekte…')}</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-5">
            <StatCard eyebrow={tr('Berilgan talonlar', 'Berilgen talonlar')} value={data.metrics.ticketsToday} />
            <StatCard
              eyebrow={tr("O'rtacha kutish", 'Ortasha kútiw')}
              value={data.metrics.avgWaitMinutes}
              unit={tr('daq', 'min')}
            />
            <StatCard
              eyebrow={tr('Faol oynalar', 'Belsendi áyneler')}
              value={data.metrics.activeCounters}
              unit="/ 5"
            />
            <StatCard
              eyebrow={tr("Xizmat ko'rsatilgan", 'Xızmet kórsetilgen')}
              value={data.metrics.served}
              hint={tr(
                `umumiydan ${Math.round((data.metrics.served / data.metrics.ticketsToday) * 100)}%`,
                `ulıwmadan ${Math.round((data.metrics.served / data.metrics.ticketsToday) * 100)}%`,
              )}
            />
          </div>

          <HourlyLoadChart data={data.hourly} />

          <section className="rounded-2xl border border-hair bg-card/40 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">{tr("So'nggi talonlar", 'Sońǵı talonlar')}</span>
              <span className="text-xs text-coal-3">{data.recent.length} {tr('ta yozuv', 'jazıw')}</span>
            </div>
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{tr('Raqam', 'Nomer')}</th>
                  <th>{tr('Kategoriya', 'Kategoriya')}</th>
                  <th>{tr('Xizmat', 'Xızmet')}</th>
                  <th>{tr('Oyna', 'Áyne')}</th>
                  <th>{tr('Holat', 'Halat')}</th>
                  <th>{tr('Vaqt', 'Waqıt')}</th>
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
                        {(() => {
                          const lbl = STATUS_LABEL[t.status];
                          return lbl ? tr(lbl.uz, lbl.kaa) : t.status;
                        })()}
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
