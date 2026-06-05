'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Hall } from '@queue/types';
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
import { useTr } from '@/lib/i18n';

interface Props {
  hall: Hall | null; // null = creating
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<Hall, 'id'> & { id?: number };

const EMPTY: Draft = {
  code: '',
  name_uz: '',
  name_ru: '',
  name_kaa: '',
  name_en: '',
  is_active: true,
  order: 0,
};

export function HallEditSheet({ hall, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(hall ?? EMPTY);

  useEffect(() => setDraft(hall ?? EMPTY), [hall]);

  const isCreate = !draft.id;

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const url = isCreate ? '/api/halls' : `/api/halls/${d.id}`;
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Hall;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['halls'] });
      toast.success(tr('Zal saqlandi', 'Zal saqlandı'));
      onOpenChange(false);
    },
    onError: () => toast.error(tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  const canSave =
    !!draft.code.trim() &&
    !!draft.name_ru.trim() &&
    !!draft.name_kaa.trim() &&
    !mutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            {isCreate ? tr('Yangi zal', 'Jańa zal') : tr(`Zal #${draft.id}`, `Zal #${draft.id}`)}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {isCreate
              ? tr('Yangi zal yaratish', 'Jańa zal jaratıw')
              : tr('Zalni tahrirlash', 'Zaldı redaktorlaw')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">{tr('Kod (1, 2, …)', 'Kod (1, 2, …)')}</Label>
              <Input
                id="code"
                value={draft.code}
                maxLength={4}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">{tr('Tartib', 'Tártip')}</Label>
              <Input
                id="order"
                type="number"
                min={0}
                className="w-24"
                value={draft.order}
                onChange={(e) =>
                  setDraft({ ...draft, order: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_uz">{tr('Nomi (uz)', 'Atı (uz)')}</Label>
            <Input
              id="name_uz"
              value={draft.name_uz ?? ''}
              onChange={(e) => setDraft({ ...draft, name_uz: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_ru">{tr('Nomi (ru)', 'Atı (ru)')}</Label>
            <Input
              id="name_ru"
              value={draft.name_ru}
              onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_kaa">{tr('Nomi (kaa)', 'Atı (kaa)')}</Label>
            <Input
              id="name_kaa"
              value={draft.name_kaa}
              onChange={(e) => setDraft({ ...draft, name_kaa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_en">{tr('Nomi (en)', 'Atı (en)')}</Label>
            <Input
              id="name_en"
              value={draft.name_en ?? ''}
              onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Faol', 'Belsendi')}</div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('Bekor qilish', 'Biykarlaw')}
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={!canSave}
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : isCreate ? tr('Yaratish', 'Jaratıw') : tr('Saqlash', 'Saqlaw')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
