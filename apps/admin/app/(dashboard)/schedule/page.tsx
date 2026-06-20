'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, User, WorkSchedule } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleEditSheet } from '@/components/ScheduleEditSheet';
import { useTr } from '@/lib/i18n';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

async function fetchSchedule(): Promise<WorkSchedule[]> {
  const res = await fetch('/api/schedule');
  return res.json();
}
async function fetchCurrent(): Promise<WorkSchedule[]> {
  const res = await fetch('/api/schedule/current');
  return res.json();
}
async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  return res.json();
}
async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}

const WEEKDAYS: { uz: string; kaa: string }[] = [
  { uz: 'Dushanba',   kaa: 'Dúyshembi' },
  { uz: 'Seshanba',   kaa: 'Siyshembi' },
  { uz: 'Chorshanba', kaa: 'Sárshembi' },
  { uz: 'Payshanba',  kaa: 'Piyshembi' },
  { uz: 'Juma',       kaa: 'Juma' },
  { uz: 'Shanba',     kaa: 'Shembi' },
  { uz: 'Yakshanba',  kaa: 'Ekshembi' },
];

export default function SchedulePage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data: shifts = [] } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule });
  const { data: onDuty = [] } = useQuery({
    queryKey: ['schedule', 'current'],
    queryFn: fetchCurrent,
    refetchInterval: 60_000, // re-check "who's on duty" every minute
  });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: counters = [] } = useQuery({ queryKey: ['counters'], queryFn: fetchCounters });

  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: ['schedule', 'current'] });
      toast.success(tr("Smena o'chirildi", 'Smena óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  // Group shifts by weekday for a readable table.
  const byDay = WEEKDAYS.map((_, wd) =>
    shifts
      .filter((s) => s.weekday === wd)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  );

  const columns = useMemo<ColumnDef<WorkSchedule>[]>(
    () => [
      {
        key: 'day',
        accessor: (s) => s.weekday,
        filter: 'select',
        options: WEEKDAYS.map((w, i) => ({ value: String(i), label: tr(w.uz, w.kaa) })),
      },
      { key: 'operator', accessor: (s) => s.user_name, filter: 'text' },
      { key: 'counter', accessor: (s) => s.counter_number, filter: 'text' },
      {
        key: 'time',
        accessor: (s) => s.start_time,
        filter: 'text',
        filterValue: (s) => s.start_time.slice(0, 5),
      },
      {
        key: 'status',
        accessor: (s) => (s.is_active ? 'active' : 'inactive'),
        filter: 'select',
        options: [
          { value: 'active', label: tr('faol', 'belsendi') },
          { value: 'inactive', label: tr("o'chiq", 'óshik') },
        ],
      },
      { key: 'actions' },
    ],
    [tr],
  );
  const ctl = useTableControls(shifts, columns);

  // One row, reused by both the grouped (default) and flat (filtered/sorted) views.
  // showDay hides the weekday on non-first rows of a group for a cleaner look.
  function renderRow(s: WorkSchedule, showDay: boolean) {
    const day = WEEKDAYS[s.weekday];
    return (
      <tr key={s.id}>
        <td className="text-coal-2">
          {showDay && day ? tr(day.uz, day.kaa) : ''}
        </td>
        <td>{s.user_name}</td>
        <td className="font-mono text-sm">№{s.counter_number}</td>
        <td className="font-mono text-sm">
          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
        </td>
        <td>
          {s.is_active ? (
            <Badge variant="outline" className="border-hair-2 text-coal">
              {tr('faol', 'belsendi')}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-hair text-coal-3">
              {tr("o'chiq", 'óshik')}
            </Badge>
          )}
        </td>
        <td>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(s)}
              className="gap-1.5 border-hair-2"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(tr(`${s.user_name} smenasini o'chirasizmi?`, `${s.user_name} smenasın óshirewdi qálaysız ba?`))) deleteMut.mutate(s.id);
              }}
              className="gap-1.5 border-hair-2 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Smenalar jadvali', 'Smenalar kestesi')}</h1>
          <p className="mt-1 text-sm text-coal-3">{tr('jadvalda', 'kestede')} {shifts.length} {tr('ta smena', 'smena')}</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr("Smena qo'shish", 'Smena qosıw')}
        </Button>
      </div>

      {/* On-duty-now strip */}
      <section className="rounded-2xl border border-hair bg-card/40 px-5 py-4">
        <div className="eyebrow text-coral">{tr("Hozir jadval bo'yicha", 'Házir keste boyınsha')}</div>
        {onDuty.length === 0 ? (
          <p className="mt-2 text-sm text-coal-3">{tr('Hozir hech kim rejalashtirilmagan.', 'Házir heshkim jobalastırılmaǵan.')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {onDuty.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="border-coral/40 bg-coral/5 px-3 py-1 text-coal"
              >
                {s.user_name} · №{s.counter_number} · {s.end_time.slice(0, 5)} {tr('gacha', 'deyin')}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Schedule grouped by weekday */}
      <section className="overflow-hidden rounded-2xl border border-hair bg-card/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <Th ctl={ctl} col="day" className="w-40">{tr('Kun', 'Kún')}</Th>
              <Th ctl={ctl} col="operator">{tr('Operator', 'Operator')}</Th>
              <Th ctl={ctl} col="counter" className="w-24">{tr('Oyna', 'Áyne')}</Th>
              <Th ctl={ctl} col="time" className="w-40">{tr('Vaqt', 'Waqıt')}</Th>
              <Th ctl={ctl} col="status" className="w-28">{tr('Holat', 'Halat')}</Th>
              <th className="w-32"></th>
            </tr>
            <FilterRow ctl={ctl} />
          </thead>
          <tbody>
            {/* Default: grouped by weekday. With an active filter/sort: flat result list. */}
            {ctl.active
              ? ctl.view.map((s) => renderRow(s, true))
              : byDay.flatMap((dayShifts) => dayShifts.map((s, i) => renderRow(s, i === 0)))}
            {ctl.view.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-coal-3">
                  {shifts.length === 0
                    ? tr("Hozircha smenalar yo'q. Birinchisini qo'shing.", 'Házirshe smenalar joq. Birinshisin qosıń.')
                    : tr('Mos keladigan smena topilmadi.', 'Sáykes smena tabılmadı.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <ScheduleEditSheet
        shift={editing}
        users={users}
        counters={counters}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <ScheduleEditSheet
        shift={null}
        users={users}
        counters={counters}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
