'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, SkipForward } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  current: Ticket | null;
}

export function CurrentTicket({ current }: Props) {
  const qc = useQueryClient();

  const finish = useMutation({
    mutationFn: (id: string) => api.finishTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Завершено');
    },
    onError: () => toast.error('Не удалось завершить'),
  });

  const skip = useMutation({
    mutationFn: (id: string) => api.skipTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast('Пропущено');
    },
    onError: () => toast.error('Не удалось пропустить'),
  });

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-800/40 p-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Сейчас обслуживаете</span>
        {current && (
          <span className="font-mono text-[10px] text-ink-500">
            #{current.id.slice(0, 6)}
          </span>
        )}
      </div>

      {current ? (
        <>
          <div className="mt-2 font-serif text-5xl font-semibold tracking-tight text-brass-400">
            {current.number}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => finish.mutate(current.id)}
              disabled={finish.isPending}
              className="h-10 flex-1 gap-1.5 bg-ink-700/70 text-xs hover:bg-ink-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Завершить
            </Button>
            <Button
              onClick={() => skip.mutate(current.id)}
              disabled={skip.isPending}
              variant="outline"
              className="h-10 flex-1 gap-1.5 border-ink-600 text-xs"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Пропустить
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-ink-400">
          Нет активного талона
        </div>
      )}
    </section>
  );
}
