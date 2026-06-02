'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

export function LoginScreen() {
  const startShift = useOperatorStore((s) => s.startShift);
  const [userId, setUserId] = useState<string>('');
  const [counterId, setCounterId] = useState<string>('');

  const users = useQuery({ queryKey: ['users'], queryFn: api.listUsers });
  const counters = useQuery({ queryKey: ['counters'], queryFn: api.listCounters });

  const operators = (users.data ?? []).filter(
    (u) => u.is_active && (u.role === 'operator' || u.role === 'admin'),
  );
  const activeCounters = (counters.data ?? []).filter((c) => c.is_active);

  const start = useMutation({
    mutationFn: () =>
      api.createSession({
        user_id: Number(userId),
        counter_id: Number(counterId),
      }),
    onSuccess: (session) => {
      const user = operators.find((u) => u.id === session.user_id);
      const counter = activeCounters.find((c) => c.id === session.counter_id);
      if (!user || !counter) {
        toast.error('Не найден пользователь или окно');
        return;
      }
      startShift({
        userId: user.id,
        userName: user.name,
        counterId: counter.id,
        counterNumber: counter.number,
        counterName: counter.name,
        sessionId: session.id,
      });
    },
    onError: () => toast.error('Не удалось начать смену'),
  });

  const canStart = userId && counterId && !start.isPending;

  return (
    <main className="flex h-screen w-screen flex-col justify-between p-6">
      <div>
        <span className="eyebrow text-brass-500">NDPI · Пульт</span>
        <h1 className="mt-3 text-xl font-semibold leading-tight">
          Начало смены
        </h1>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">Оператор</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue placeholder="Выбрать…" />
            </SelectTrigger>
            <SelectContent>
              {operators.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} · {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Окно</Label>
          <Select value={counterId} onValueChange={setCounterId}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue placeholder="Выбрать…" />
            </SelectTrigger>
            <SelectContent>
              {activeCounters.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  №{c.number} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => start.mutate()}
        disabled={!canStart}
        className="h-12 w-full bg-brass-500 text-ink-900 hover:bg-brass-400"
      >
        {start.isPending ? '…' : 'Начать смену'}
      </Button>
    </main>
  );
}
