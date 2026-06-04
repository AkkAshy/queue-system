'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, User, WorkSchedule, Weekday } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
];

interface Props {
  shift: WorkSchedule | null;
  users: User[];
  counters: Counter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Draft {
  id?: number;
  user_id: number | null;
  counter_id: number | null;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const EMPTY: Draft = {
  user_id: null,
  counter_id: null,
  weekday: 0,
  start_time: '09:00',
  end_time: '18:00',
  is_active: true,
};

function toDraft(s: WorkSchedule | null): Draft {
  if (!s) return EMPTY;
  return {
    id: s.id,
    user_id: s.user_id,
    counter_id: s.counter_id,
    weekday: s.weekday,
    // backend may send "HH:MM:SS" — trim to "HH:MM" for the time input
    start_time: s.start_time.slice(0, 5),
    end_time: s.end_time.slice(0, 5),
    is_active: s.is_active,
  };
}

export function ScheduleEditSheet({ shift, users, counters, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(toDraft(shift));

  useEffect(() => setDraft(toDraft(shift)), [shift]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/schedule' : `/api/schedule/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.end_time?.[0] ?? 'save failed');
      }
      return (await res.json()) as WorkSchedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: ['schedule', 'current'] });
      toast.success(draft.id ? 'Смена обновлена' : 'Смена добавлена');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Не удалось сохранить'),
  });

  const operators = users.filter((u) => u.role === 'operator' || u.role === 'admin');
  const valid = draft.user_id && draft.counter_id && draft.start_time < draft.end_time;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {shift ? `Смена #${shift.id}` : 'Новая смена'}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            Повторяющийся график работы оператора за окном
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label>Оператор</Label>
            <Select
              value={draft.user_id ? String(draft.user_id) : ''}
              onValueChange={(v) => setDraft({ ...draft, user_id: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— выберите —" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Окно</Label>
            <Select
              value={draft.counter_id ? String(draft.counter_id) : ''}
              onValueChange={(v) => setDraft({ ...draft, counter_id: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— выберите —" />
              </SelectTrigger>
              <SelectContent>
                {counters.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    №{c.number} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>День недели</Label>
            <Select
              value={String(draft.weekday)}
              onValueChange={(v) => setDraft({ ...draft, weekday: Number(v) as Weekday })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((w) => (
                  <SelectItem key={w.value} value={String(w.value)}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Начало</Label>
              <Input
                id="start"
                type="time"
                value={draft.start_time}
                onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Конец</Label>
              <Input
                id="end"
                type="time"
                value={draft.end_time}
                onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
              />
            </div>
          </div>
          {draft.start_time >= draft.end_time && (
            <p className="text-xs text-red-400">Конец смены должен быть позже начала.</p>
          )}

          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активна</div>
              <div className="text-xs text-coal-3">Учитывается в графике</div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending || !valid}
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
