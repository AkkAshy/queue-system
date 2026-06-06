'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, SkipForward, Volume2 } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useTr } from '@/lib/i18n';

interface Props {
  current: Ticket | null;
}

export function CurrentTicket({ current }: Props) {
  const tr = useTr();
  const qc = useQueryClient();

  const finish = useMutation({
    mutationFn: (id: string) => api.finishTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success(tr('Tugatildi', 'Tamamlandı'));
    },
    onError: () => toast.error(tr('Tugatib bo\'lmadi', 'Tamamlay almadı')),
  });

  const skip = useMutation({
    mutationFn: (id: string) => api.skipTicket(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast(tr('O\'tkazib yuborildi', 'Ótkizip jiberildi'));
    },
    onError: () => toast.error(tr('O\'tkazib bo\'lmadi', 'Ótkize almadı')),
  });

  const recall = useMutation({
    mutationFn: (id: string) => api.recallTicket(id),
    onSuccess: () => toast(tr('Takroriy chaqiruv', 'Qaytalanǵan shaqırıw')),
    onError: () => toast.error(tr('Takrorlab bo\'lmadi', 'Qaytalay almadı')),
  });

  return (
    <section className="rounded-rlg bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{tr('Hozir xizmat ko\'rsatyapsiz', 'Házir xızmet kórsetpekte')}</span>
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
              {tr('Tugatish', 'Tamamlaw')}
            </Button>
            <Button
              onClick={() => skip.mutate(current.id)}
              disabled={skip.isPending}
              variant="outline"
              className="h-10 flex-1 gap-1.5 rounded-rsm border-hair-2 text-xs"
            >
              <SkipForward className="h-3.5 w-3.5" />
              {tr('O\'tkazib yuborish', 'Ótkizip jiberiw')}
            </Button>
          </div>
          <Button
            onClick={() => recall.mutate(current.id)}
            disabled={recall.isPending}
            variant="outline"
            className="mt-2 h-9 w-full gap-1.5 rounded-rsm border-hair-2 text-xs"
          >
            <Volume2 className="h-3.5 w-3.5" />
            {tr('Chaqiruvni takrorlash', 'Shaqırıwdı qaytalaw')}
          </Button>
        </>
      ) : (
        <div className="mt-3 text-sm text-coal-3">{tr('Faol talon yo\'q', 'Aktiv talon joq')}</div>
      )}
    </section>
  );
}
