'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, User, WorkSchedule } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleEditSheet } from '@/components/ScheduleEditSheet';

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

const WEEKDAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

export default function SchedulePage() {
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
      toast.success('Смена удалена');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  // Group shifts by weekday for a readable table.
  const byDay = WEEKDAYS.map((_, wd) =>
    shifts
      .filter((s) => s.weekday === wd)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Расписание смен</h1>
          <p className="mt-1 text-sm text-coal-3">{shifts.length} смен в графике</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          Добавить смену
        </Button>
      </div>

      {/* On-duty-now strip */}
      <section className="rounded-2xl border border-hair bg-white/40 px-5 py-4">
        <div className="eyebrow text-coral">Сейчас по графику</div>
        {onDuty.length === 0 ? (
          <p className="mt-2 text-sm text-coal-3">Сейчас никто не запланирован.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {onDuty.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="border-coral/40 bg-coral/5 px-3 py-1 text-coal"
              >
                {s.user_name} · №{s.counter_number} · до {s.end_time.slice(0, 5)}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Schedule grouped by weekday */}
      <section className="overflow-hidden rounded-2xl border border-hair bg-white/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th className="w-40">День</th>
              <th>Оператор</th>
              <th className="w-24">Окно</th>
              <th className="w-40">Время</th>
              <th className="w-28">Статус</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {byDay.flatMap((dayShifts, wd) =>
              dayShifts.map((s, i) => (
                <tr key={s.id}>
                  {/* show the day name only on the first row of each group */}
                  <td className="text-coal-2">{i === 0 ? WEEKDAYS[wd] : ''}</td>
                  <td>{s.user_name}</td>
                  <td className="font-mono text-sm">№{s.counter_number}</td>
                  <td className="font-mono text-sm">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </td>
                  <td>
                    {s.is_active ? (
                      <Badge variant="outline" className="border-hair-2 text-coal">
                        активна
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-hair text-coal-3">
                        выкл
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
                          if (confirm(`Удалить смену ${s.user_name}?`)) deleteMut.mutate(s.id);
                        }}
                        className="gap-1.5 border-hair-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )),
            )}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-coal-3">
                  Смен пока нет. Добавьте первую.
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
