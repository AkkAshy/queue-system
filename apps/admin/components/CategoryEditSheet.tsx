'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Hall, ServiceCategory } from '@queue/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTr } from '@/lib/i18n';

interface Props {
  category: ServiceCategory | null; // null = creating
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<ServiceCategory, 'id'> & { id?: number };

const EMPTY: Draft = {
  code: '',
  name_kaa: '',
  name_ru: '',
  color: '#DC6A4C',
  order: 0,
  hall_id: null,
};

export function CategoryEditSheet({ category, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(category ?? EMPTY);

  const { data: halls = [] } = useQuery({
    queryKey: ['halls'],
    queryFn: async () => (await fetch('/api/halls')).json() as Promise<Hall[]>,
  });

  useEffect(() => setDraft(category ?? EMPTY), [category]);

  // On create, default the hall to the first available one if none chosen.
  useEffect(() => {
    const first = halls[0];
    if (!category && first) {
      setDraft((d) => (d.hall_id == null ? { ...d, hall_id: first.id } : d));
    }
  }, [category, halls]);

  const isCreate = !draft.id;

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const url = isCreate ? '/api/categories' : `/api/categories/${d.id}`;
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as ServiceCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(isCreate ? tr('Kategoriya yaratildi', 'Kategoriya jaratıldı') : tr('Saqlandi', 'Saqlandı'));
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
            {isCreate ? tr('Yangi kategoriya', 'Jańa kategoriya') : tr(`Kategoriya ${draft.code}`, `Kategoriya ${draft.code}`)}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {isCreate ? tr('Xizmat kategoriyasini yaratish', 'Xızmet kategoriyasın jaratıw') : tr('Kategoriyani tahrirlash', 'Kategoriyanı redaktorlaw')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">{tr('Kod (A, B, …)', 'Kod (A, B, …)')}</Label>
              <Input
                id="code"
                value={draft.code}
                maxLength={4}
                onChange={(e) =>
                  setDraft({ ...draft, code: e.target.value.toUpperCase() })
                }
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
            <Label>{tr('Zal', 'Zal')}</Label>
            <Select
              value={draft.hall_id != null ? String(draft.hall_id) : undefined}
              onValueChange={(v) => setDraft({ ...draft, hall_id: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {halls.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {tr(h.name_uz || h.name_ru, h.name_kaa)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">{tr('Rang', 'Reń')}</Label>
            <input
              id="color"
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-10 w-16 cursor-pointer rounded-md border border-hair bg-card"
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
