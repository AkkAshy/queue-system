'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Ticket } from '@queue/types';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { useTr } from '@/lib/i18n';

interface Props {
  current: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferSheet({ current, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const myCounterId = useOperatorStore((s) => s.counterId);
  const [destination, setDestination] = useState<string>('');

  const counters = useQuery({ queryKey: ['counters'], queryFn: api.listCounters });
  const others = (counters.data ?? []).filter(
    (c) => c.is_active && c.id !== myCounterId,
  );

  const transfer = useMutation({
    mutationFn: () => {
      if (!current) throw new Error('no current');
      return api.transferTicket(current.id, { counter_id: Number(destination) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current'] });
      qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success(tr('O\'tkazildi', 'Ótkizildi'));
      setDestination('');
      onOpenChange(false);
    },
    onError: () => toast.error(tr('O\'tkazib bo\'lmadi', 'Ótkize almadı')),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold text-coal">
            {tr('O\'tkazish', 'Ótkiziw')} {current?.number ?? ''}
          </SheetTitle>
          <SheetDescription className="text-xs text-coal-3">
            {tr('Talonni qaysi oynaga o\'tkazishni tanlang', 'Talondı qaysı áynege ótkizetuǵınıńızdı saylań')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-6 space-y-2">
          <Label className="text-xs">{tr('Tayinlangan oyna', 'Tayınlanǵan áyne')}</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger><SelectValue placeholder={tr('Tanlash…', 'Saylaw…')} /></SelectTrigger>
            <SelectContent>
              {others.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  №{c.number} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('Bekor qilish', 'Biykarlaw')}
          </Button>
          <Button
            onClick={() => transfer.mutate()}
            disabled={!destination || !current || transfer.isPending}
            className="rounded-r bg-coral font-bold text-white hover:bg-coral-600"
          >
            {transfer.isPending ? '…' : tr('O\'tkazish', 'Ótkiziw')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
