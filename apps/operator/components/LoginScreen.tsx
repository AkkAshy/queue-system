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
import { LangSwitcher } from '@/components/LangSwitcher';
import { useTr } from '@/lib/i18n';

export function LoginScreen() {
  const tr = useTr();
  const startShift = useOperatorStore((s) => s.startShift);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [counterId, setCounterId] = useState('');

  // Counters list is public (GET); the users list is chief-only now → operators
  // authenticate by username + password instead of picking themselves.
  const counters = useQuery({ queryKey: ['counters'], queryFn: api.listCounters });
  const activeCounters = (counters.data ?? []).filter((c) => c.is_active);

  const start = useMutation({
    mutationFn: async () => {
      const auth = await api.login(username.trim(), password);
      const session = await api.createSession({
        user_id: auth.user_id,
        counter_id: Number(counterId),
      });
      return { auth, session };
    },
    onSuccess: ({ auth, session }) => {
      const counter = activeCounters.find((c) => c.id === session.counter_id);
      if (!counter) {
        toast.error(tr('Oyna topilmadi', 'Áyne tabılmadı'));
        return;
      }
      startShift({
        token: auth.token,
        userId: auth.user_id,
        userName: auth.name || auth.username,
        counterId: counter.id,
        counterNumber: counter.number,
        counterName: counter.name,
        sessionId: session.id,
      });
    },
    onError: () => toast.error(tr('Login yoki parol noto\'g\'ri', 'Login yamasa parol qáte')),
  });

  const canStart = !!(username.trim() && password && counterId && !start.isPending);
  const inputCls =
    'h-11 w-full rounded-rsm border border-hair-2 bg-white px-3 text-sm text-coal outline-none focus:border-coral';

  return (
    <main className="flex h-screen w-screen flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between">
          <span className="eyebrow text-coral">NDPI · Pult</span>
          <LangSwitcher />
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-coal">{tr('Kirish', 'Kiriw')}</h1>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) start.mutate();
        }}
      >
        <div className="space-y-2">
          <Label className="text-xs">Login</Label>
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{tr('Parol', 'Parol')}</Label>
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{tr('Oyna', 'Áyne')}</Label>
          <Select value={counterId} onValueChange={setCounterId}>
            <SelectTrigger className="h-11 text-sm">
              <SelectValue placeholder={tr('Tanlash…', 'Saylaw…')} />
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

        <Button
          type="submit"
          disabled={!canStart}
          className="h-12 w-full rounded-r bg-coral font-bold text-white shadow-coral hover:bg-coral-600"
        >
          {start.isPending ? '…' : tr('Smenani boshlash', 'Smenanı baslaw')}
        </Button>
      </form>
    </main>
  );
}
