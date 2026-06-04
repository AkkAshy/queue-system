'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, SkipForward, Volume2 } from 'lucide-react';
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

  const recall = useMutation({
    mutationFn: (id: string) => api.recallTicket(id),
    onSuccess: () => toast('Повторный вызов'),
    onError: () => toast.error('Не удалось повторить'),
  });

  return (
    <section className="rounded-rlg bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Сейчас обслуживаете</span>
        {current && (
          <span className="text-[10px] text-coal-3">#{current.id.slice(0, 6)}</span>
        )}
      </div>

      {current ? (
        <>
          <div className="mt-2 text-5xl font-extrabold tracking-tight text-coral">
            {current.number}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => finish.mutate(current.id)}
              disabled={finish.isPending}
              className="h-10 flex-1 gap-1.5 rounded-rsm bg-coral text-xs font-semibold text-white hover:bg-coral-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Завершить
            </Button>
            <Button
              onClick={() => skip.mutate(current.id)}
              disabled={skip.isPending}
              variant="outline"
              className="h-10 flex-1 gap-1.5 rounded-rsm border-hair-2 text-xs"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Пропустить
            </Button>
          </div>
          <Button
            onClick={() => recall.mutate(current.id)}
            disabled={recall.isPending}
            variant="outline"
            className="mt-2 h-9 w-full gap-1.5 rounded-rsm border-hair-2 text-xs"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Повторить вызов
          </Button>
        </>
      ) : (
        <div className="mt-3 text-sm text-coal-3">Нет активного талона</div>
      )}
    </section>
  );
}
