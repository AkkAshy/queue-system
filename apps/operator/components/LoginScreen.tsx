'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { LangSwitcher } from '@/components/LangSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTr } from '@/lib/i18n';

export function LoginScreen() {
  const tr = useTr();
  const startShift = useOperatorStore((s) => s.startShift);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // The operator no longer picks a hall/window — the admin assigns the window to
  // the account (User.counter, via the admin → Operatorlar page). On login we
  // read the assigned counter from the auth response and resolve its label from
  // the public counters list. The hall follows from the counter (Counter.hall).
  const start = useMutation({
    mutationFn: async () => {
      const auth = await api.login(username.trim(), password);
      if (!auth.counter_id) {
        throw Object.assign(new Error('no-counter'), { code: 'NO_COUNTER' });
      }
      const counters = await api.listCounters();
      const counter = counters.find((c) => c.id === auth.counter_id);
      if (!counter) {
        throw Object.assign(new Error('no-counter'), { code: 'NO_COUNTER' });
      }
      const session = await api.createSession({
        user_id: auth.user_id,
        counter_id: counter.id,
      });
      return { auth, counter, session };
    },
    onSuccess: ({ auth, counter, session }) => {
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
    onError: (err: unknown) => {
      if ((err as { code?: string })?.code === 'NO_COUNTER') {
        toast.error(
          tr(
            'Sizga oyna biriktirilmagan. Administratorga murojaat qiling.',
            'Sizge áyne biriktirilmegen. Administratorǵa múrájat etiń.',
          ),
        );
        return;
      }
      toast.error(tr("Login yoki parol noto'g'ri", 'Login yamasa parol qáte'));
    },
  });

  const canStart = !!(username.trim() && password && !start.isPending);
  const inputCls =
    'h-11 w-full rounded-rsm border border-hair-2 bg-card px-3 text-sm text-coal outline-none focus:border-coral';

  return (
    <main className="flex h-screen w-screen flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between">
          <span className="eyebrow text-coral">NDPI · Pult</span>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            <LangSwitcher />
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-coal">{tr('Kirish', 'Kiriw')}</h1>
        <p className="mt-1 text-sm text-coal-3">
          {tr(
            'Oynangiz administrator tomonidan biriktiriladi',
            'Áynéńiz administrator tárepinen biriktiriledi',
          )}
        </p>
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
