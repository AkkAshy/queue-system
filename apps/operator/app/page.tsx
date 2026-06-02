'use client';

import { useQuery } from '@tanstack/react-query';
import type { Service } from '@queue/types';
import { LoginScreen } from '@/components/LoginScreen';
import { CurrentTicket } from '@/components/CurrentTicket';
import { CallNextButton } from '@/components/CallNextButton';
import { QueueList } from '@/components/QueueList';
import { OperatorFooter } from '@/components/OperatorFooter';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';

async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function Page() {
  const signedIn = useOperatorStore((s) => s.isSignedIn());
  const counterId = useOperatorStore((s) => s.counterId);
  const counterNumber = useOperatorStore((s) => s.counterNumber);
  const counterName = useOperatorStore((s) => s.counterName);
  const userName = useOperatorStore((s) => s.userName);
  const onBreak = useOperatorStore((s) => s.onBreak);

  const current = useQuery({
    queryKey: ['current', counterId],
    queryFn: () => api.getCurrent(counterId!),
    enabled: !!counterId,
    refetchInterval: 3000,
  });
  const queue = useQuery({
    queryKey: ['queue', counterId],
    queryFn: () => api.getQueue(counterId!),
    enabled: !!counterId && !onBreak,
    refetchInterval: onBreak ? false : 3000,
  });
  const services = useQuery({ queryKey: ['services'], queryFn: fetchServices });

  if (!signedIn) return <LoginScreen />;

  const next = (queue.data ?? [])[0] ?? null;

  return (
    <main className="flex h-screen w-screen flex-col gap-3 p-4">
      <header className="leading-tight">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-brass-400">
            №{counterNumber}
          </span>
          <span className="truncate text-xs text-ink-300">{counterName}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-ink-400">· {userName}</span>
          {onBreak && (
            <span className="rounded-full border border-brass-500/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brass-400">
              перерыв
            </span>
          )}
        </div>
      </header>

      <CurrentTicket current={current.data ?? null} />

      <CallNextButton
        nextTicket={next}
        current={current.data ?? null}
        onBreak={onBreak}
      />

      <QueueList queue={queue.data ?? []} services={services.data ?? []} />

      <OperatorFooter current={current.data ?? null} />
    </main>
  );
}
