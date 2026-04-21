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
  category: ServiceCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryEditSheet({ category, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ServiceCategory | null>(category);

  useEffect(() => setDraft(category), [category]);

  const mutation = useMutation({
    mutationFn: async (c: ServiceCategory) => {
      const res = await fetch(`/api/categories/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as ServiceCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Сохранено');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            Категория {draft.code}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Редактирование карточки категории
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name_kaa">Название (kaa)</Label>
            <Input
              id="name_kaa"
              value={draft.name_kaa}
              onChange={(e) => setDraft({ ...draft, name_kaa: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_ru">Название (ru)</Label>
            <Input
              id="name_ru"
              value={draft.name_ru}
              onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Цвет</Label>
              <input
                id="color"
                type="color"
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-10 w-16 cursor-pointer rounded-md border border-ink-700 bg-ink-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Порядок</Label>
              <Input
                id="order"
                type="number"
                min={0}
                value={draft.order}
                onChange={(e) =>
                  setDraft({ ...draft, order: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </div>

        <SheetFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => mutation.mutate(draft)}
            disabled={mutation.isPending}
            className="bg-brass-500 text-ink-900 hover:bg-brass-400"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
