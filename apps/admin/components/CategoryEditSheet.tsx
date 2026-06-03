'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ServiceCategory } from '@queue/types';
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
};

export function CategoryEditSheet({ category, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(category ?? EMPTY);

  useEffect(() => setDraft(category ?? EMPTY), [category]);

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
      toast.success(isCreate ? 'Категория создана' : 'Сохранено');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
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
            {isCreate ? 'Новая категория' : `Категория ${draft.code}`}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {isCreate ? 'Создание категории услуг' : 'Редактирование категории'}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Код (A, B, …)</Label>
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
              <Label htmlFor="order">Порядок</Label>
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
            <Label htmlFor="name_ru">Название (ru)</Label>
            <Input
              id="name_ru"
              value={draft.name_ru}
              onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_kaa">Название (kaa)</Label>
            <Input
              id="name_kaa"
              value={draft.name_kaa}
              onChange={(e) => setDraft({ ...draft, name_kaa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Цвет</Label>
            <input
              id="color"
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-10 w-16 cursor-pointer rounded-md border border-hair bg-white"
            />
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={!canSave}
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : isCreate ? 'Создать' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
