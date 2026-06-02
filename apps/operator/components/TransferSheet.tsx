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

interface Props {
  current: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferSheet({ current, open, onOpenChange }: Props) {
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
      toast.success('Переведено');
      setDestination('');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось перевести'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl font-normal">
            Перевод {current?.number ?? ''}
          </SheetTitle>
          <SheetDescription className="text-xs text-ink-400">
            Выберите окно, куда передать талон
          </SheetDescription>
        </SheetHeader>

        <div className="my-6 space-y-2">
          <Label className="text-xs">Окно назначения</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger><SelectValue placeholder="Выбрать…" /></SelectTrigger>
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
            Отмена
          </Button>
          <Button
            onClick={() => transfer.mutate()}
            disabled={!destination || !current || transfer.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {transfer.isPending ? '…' : 'Перевести'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
