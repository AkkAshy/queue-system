'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { localizedName, type Counter, type Service } from '@queue/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useTr, useLang } from '@/lib/i18n';

interface Props {
  counter: Counter | null; // null = creating
  services: Service[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<Counter, 'id'> & { id?: number };

const EMPTY: Draft = {
  number: '',
  name: '',
  service_ids: [],
  is_active: true,
};

export function CounterEditSheet({ counter, services, open, onOpenChange }: Props) {
  const tr = useTr();
  const { lang } = useLang();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(counter ?? EMPTY);

  useEffect(() => {
    setDraft(counter ?? EMPTY);
  }, [counter]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/counters' : `/api/counters/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Counter;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counters'] });
      toast.success(draft.id ? tr('Oyna yangilandi', 'Áyne jańalandı') : tr('Oyna yaratildi', 'Áyne jaratıldı'));
      onOpenChange(false);
    },
    onError: () => toast.error(tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  function toggleService(id: number) {
    setDraft((d) => ({
      ...d,
      service_ids: d.service_ids.includes(id)
        ? d.service_ids.filter((x) => x !== id)
        : [...d.service_ids, id],
    }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {counter ? tr(`Oyna #${counter.id}`, `Áyne #${counter.id}`) : tr('Yangi oyna', 'Jańa áyne')}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {tr("Operator ish o'rnini sozlash", 'Operator jumıs ornın sazlaw')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="number">{tr('Raqam', 'Nomer')}</Label>
              <Input
                id="number"
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                className="w-24 text-center font-mono text-lg"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{tr('Nomi', 'Atı')}</Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Faol', 'Belsendi')}</div>
              <div className="text-xs text-coal-3">
                {tr('Navbat taqsimotida ishtirok etadi', 'Nóbet bólistiriwinde qatnasadı')}
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>{tr("Xizmat ko'rsatiladigan xizmatlar", 'Xızmet kórsetiletuǵın xızmetler')} ({draft.service_ids.length})</Label>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-hair p-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-card/60"
                >
                  <Checkbox
                    checked={draft.service_ids.includes(s.id)}
                    onCheckedChange={() => toggleService(s.id)}
                  />
                  <span className="flex-1 text-sm">{localizedName(s, lang)}</span>
                  <span className="font-mono text-xs text-coal-3">#{s.id}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('Bekor qilish', 'Biykarlaw')}
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : tr('Saqlash', 'Saqlaw')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
