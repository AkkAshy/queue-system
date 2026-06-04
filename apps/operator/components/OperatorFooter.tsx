'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Coffee, ArrowRightLeft, LogOut } from 'lucide-react';
import type { Ticket } from '@queue/types';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useOperatorStore } from '@/store/operator-store';
import { TransferSheet } from './TransferSheet';
import { useTr } from '@/lib/i18n';

interface Props {
  current: Ticket | null;
}

export function OperatorFooter({ current }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  // Individual selectors — a destructured-object selector returns a fresh object
  // each render and triggers re-render storms in React 19 RC (the admin TopBar bug).
  const sessionId = useOperatorStore((s) => s.sessionId);
  const onBreak = useOperatorStore((s) => s.onBreak);
  const setOnBreak = useOperatorStore((s) => s.setOnBreak);
  const logout = useOperatorStore((s) => s.logout);
  const [transferOpen, setTransferOpen] = useState(false);

  const toggleBreak = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error('no session');
      return api.updateSession(sessionId, onBreak ? 'active' : 'break');
    },
    onSuccess: () => {
      setOnBreak(!onBreak);
      toast(onBreak ? tr('Ish davom ettirildi', 'Jumıs dawam etti') : tr('Siz tanaffusdasiz', 'Siz tanaffustasız'));
    },
    onError: () => toast.error(tr('Amalga oshmadi', 'Ámelge aspadı')),
  });

  const endShift = useMutation({
    mutationFn: async () => {
      if (!sessionId) return;
      await api.updateSession(sessionId, 'ended');
    },
    onSuccess: () => {
      qc.clear();
      logout();
    },
  });

  return (
    <>
      <footer className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleBreak.mutate()}
          disabled={toggleBreak.isPending}
          className="h-9 flex-1 gap-1.5 rounded-rsm border-hair-2 bg-white text-[11px]"
        >
          <Coffee className="h-3 w-3" />
          {onBreak ? tr('Davom etish', 'Dawam etiw') : tr('Tanaffus', 'Tanaffus')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTransferOpen(true)}
          disabled={!current}
          className="h-9 flex-1 gap-1.5 rounded-rsm border-hair-2 bg-white text-[11px]"
        >
          <ArrowRightLeft className="h-3 w-3" />
          {tr('O\'tkazish', 'Ótkiziw')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => endShift.mutate()}
          className="h-9 gap-1.5 rounded-rsm border-hair-2 bg-white text-[11px] text-coal-3"
        >
          <LogOut className="h-3 w-3" />
        </Button>
      </footer>

      <TransferSheet
        current={current}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
    </>
  );
}
