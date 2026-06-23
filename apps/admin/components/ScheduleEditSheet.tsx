'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, User, WorkSchedule, Weekday, ScheduleBulkResult } from '@queue/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useTr } from '@/lib/i18n';

const WEEKDAYS: { value: Weekday; uz: string; kaa: string }[] = [
  { value: 0, uz: 'Dushanba',   kaa: 'Dúyshembi' },
  { value: 1, uz: 'Seshanba',   kaa: 'Siyshembi' },
  { value: 2, uz: 'Chorshanba', kaa: 'Sárshembi' },
  { value: 3, uz: 'Payshanba',  kaa: 'Piyshembi' },
  { value: 4, uz: 'Juma',       kaa: 'Juma' },
  { value: 5, uz: 'Shanba',     kaa: 'Shembi' },
  { value: 6, uz: 'Yakshanba',  kaa: 'Ekshembi' },
];

const WORKDAYS: Weekday[] = [0, 1, 2, 3, 4];
const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  shift: WorkSchedule | null;
  users: User[];
  counters: Counter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleEditSheet({ shift, users, counters, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const isEdit = shift !== null;

  // Multi-select: pick days first, then the operators who work them. Each
  // operator's window comes from their profile, so no counter is picked here.
  const [days, setDays] = useState<Set<Weekday>>(new Set());
  const [userIds, setUserIds] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isActive, setIsActive] = useState(true);

  // Reset the form whenever it opens or the edited shift changes.
  useEffect(() => {
    if (shift) {
      setDays(new Set([shift.weekday]));
      setUserIds(new Set([shift.user_id]));
      setStartTime(shift.start_time.slice(0, 5));
      setEndTime(shift.end_time.slice(0, 5));
      setIsActive(shift.is_active);
    } else {
      setDays(new Set());
      setUserIds(new Set());
      setStartTime('09:00');
      setEndTime('18:00');
      setIsActive(true);
    }
  }, [shift, open]);

  const operators = users.filter((u) => u.role === 'operator' || u.role === 'admin');
  const counterOf = (u: User) => counters.find((c) => c.id === u.counter_id);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          weekdays: [...days],
          user_ids: [...userIds],
          start_time: startTime,
          end_time: endTime,
          is_active: isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.end_time?.[0] ?? body?.weekdays?.[0] ?? body?.user_ids?.[0] ?? 'save failed',
        );
      }
      return (await res.json()) as ScheduleBulkResult;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: ['schedule', 'current'] });
      const parts: string[] = [];
      if (r.created.length) parts.push(tr(`${r.created.length} ta yaratildi`, `${r.created.length} jaratıldı`));
      if (r.updated) parts.push(tr(`${r.updated} ta yangilandi`, `${r.updated} jańalandı`));
      toast.success(parts.join(' · ') || tr('Saqlandi', 'Saqlandı'));
      // Operators skipped for having no window assigned.
      if (r.no_counter.length) {
        const names = r.no_counter
          .map((id) => operators.find((u) => u.id === id)?.name || `#${id}`)
          .join(', ');
        toast.warning(tr(`Oynasi yo'q (o'tkazildi): ${names}`, `Áynesi joq (ótkerildi): ${names}`));
      }
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  const toggleDay = (d: Weekday) =>
    setDays((s) => {
      const n = new Set(s);
      n.has(d) ? n.delete(d) : n.add(d);
      return n;
    });
  const toggleUser = (id: number) =>
    setUserIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const valid = days.size > 0 && userIds.size > 0 && startTime < endTime;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-md flex-col overflow-y-auto bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {isEdit ? tr(`Smena #${shift!.id}`, `Smena #${shift!.id}`) : tr('Smena belgilash', 'Smena belgilew')}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {tr(
              'Avval kunlarni, keyin shu kunlarda ishlaydigan operatorlarni tanlang. Oyna profilidan olinadi.',
              'Aldın kúnlerdi, keyin sol kúnleri islewshi operatorlardı saylań. Áyne profilinen alınadı.',
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 flex-1 space-y-6">
          {/* 1 — Days */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tr('Kunlar', 'Kúnler')}</Label>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => setDays(new Set(WORKDAYS))} className="text-coral hover:underline">
                  {tr('Ish kunlari', 'Jumıs kúnleri')}
                </button>
                <button type="button" onClick={() => setDays(new Set(ALL_DAYS))} className="text-coral hover:underline">
                  {tr('Hammasi', 'Hámmesi')}
                </button>
                <button type="button" onClick={() => setDays(new Set())} className="text-coal-3 hover:underline">
                  {tr('Tozalash', 'Tazalaw')}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w) => {
                const on = days.has(w.value);
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleDay(w.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition',
                      on
                        ? 'border-coral bg-coral text-cream'
                        : 'border-hair-2 text-coal-2 hover:border-coral/50',
                    )}
                  >
                    {tr(w.uz, w.kaa)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 — Operators (window taken from each profile) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{tr('Operatorlar', 'Operatorlar')}</Label>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setUserIds(new Set(operators.filter((u) => u.counter_id).map((u) => u.id)))
                  }
                  className="text-xs text-coral hover:underline"
                >
                  {tr('Hammasini tanlash', 'Hámmesin saylaw')}
                </button>
              )}
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-hair p-1">
              {operators.map((u) => {
                const c = counterOf(u);
                const on = userIds.has(u.id);
                // When editing, the operator is fixed — you can change days/time
                // for that person, not swap who the shift belongs to.
                const disabled = isEdit && u.id !== shift!.user_id;
                return (
                  <label
                    key={u.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2',
                      disabled ? 'opacity-40' : 'cursor-pointer hover:bg-hair/40',
                    )}
                  >
                    <Checkbox checked={on} disabled={disabled} onCheckedChange={() => toggleUser(u.id)} />
                    <span className="flex-1 text-sm">{u.name || u.username}</span>
                    <span className="font-mono text-xs text-coal-3">
                      {c ? `№${c.number}` : tr('oynasiz', 'áynesiz')}
                    </span>
                  </label>
                );
              })}
              {operators.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-coal-3">
                  {tr("Operatorlar yo'q", 'Operatorlar joq')}
                </p>
              )}
            </div>
          </div>

          {/* 3 — Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">{tr('Boshlanishi', 'Baslanıwı')}</Label>
              <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">{tr('Tugashi', 'Tamamlanıwı')}</Label>
              <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          {startTime >= endTime && (
            <p className="text-xs text-red-400">
              {tr(
                "Smena tugashi boshlanishidan kechroq bo'lishi kerak.",
                'Smena tamamlanıwı baslanıwınan keshirek bolıwı kerek.',
              )}
            </p>
          )}

          {/* 4 — Active */}
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Faol', 'Belsendi')}</div>
              <div className="text-xs text-coal-3">{tr('Jadvalda hisobga olinadi', 'Kestede esapqa alınadı')}</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('Bekor qilish', 'Biykarlaw')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !valid}
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : tr('Saqlash', 'Saqlaw')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
