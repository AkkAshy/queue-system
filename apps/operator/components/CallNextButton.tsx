'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { useTr } from '@/lib/i18n';

interface Props {
  nextTicket: Ticket | null;   // oldest waiting, or null
  current: Ticket | null;       // blocks new call when present
  onBreak: boolean;
}

export function CallNextButton({ nextTicket, current, onBreak }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const counterId = useOperatorStore((s) => s.counterId);
  const userId = useOperatorStore((s) => s.userId);

  const call = useMutation({
    mutationFn: () => {
      if (!counterId || !userId) throw new Error('not signed in');
      return api.callNext({ counter_id: counterId, operator_id: userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: () => toast.error(tr('Chaqirib bo\'lmadi', 'Shaqıra almadı')),
  });

  let label: string;
  let disabled = false;

  if (onBreak) {
    label = tr('Tanaffusda', 'Tanaffusta');
    disabled = true;
  } else if (current) {
    label = tr('Joriyni tugating', 'Ágımdaǵını tamamlań');
    disabled = true;
  } else if (!nextTicket) {
    label = tr('Navbat bo\'sh', 'Nóbet bos');
    disabled = true;
  } else {
    label = `${tr('CHAQIRISH', 'SHAQIRIW')} ${nextTicket.number}`;
  }

  return (
    <Button
      onClick={() => call.mutate()}
      disabled={disabled || call.isPending}
      className="h-16 w-full gap-3 rounded-r bg-coral text-base font-bold uppercase tracking-wide text-white shadow-coral transition-all duration-200 hover:bg-coral-600 active:translate-y-[1px] disabled:bg-cream-deep disabled:text-coal-3 disabled:shadow-none"
    >
      {!disabled && <ArrowRight className="h-5 w-5" />}
      <span>{label}</span>
    </Button>
  );
}
