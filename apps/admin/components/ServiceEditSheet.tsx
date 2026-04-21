'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Service, DeliveryType } from '@queue/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DELIVERY_TYPES: DeliveryType[] = [
  'electron',
  'qagaz',
  'awizeki',
  'electron_qagaz',
  'electron_awizeki',
  'jiynalmali_papka',
];

interface Props {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceEditSheet({ service, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Service | null>(service);

  useEffect(() => {
    setDraft(service);
  }, [service]);

  const mutation = useMutation({
    mutationFn: async (s: Service) => {
      const res = await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Service;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Сохранено');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto bg-ink-900 text-paper-100">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            Услуга #{draft.id}
          </SheetTitle>
          <SheetDescription className="text-ink-400">
            Редактирование карточки услуги
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sla_days">Срок (дней)</Label>
              <Input
                id="sla_days"
                type="number"
                min={0}
                value={draft.sla_days}
                onChange={(e) =>
                  setDraft({ ...draft, sla_days: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Тип выдачи</Label>
              <Select
                value={draft.delivery_type}
                onValueChange={(v) =>
                  setDraft({ ...draft, delivery_type: v as DeliveryType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Требует визит</div>
              <div className="text-xs text-ink-400">
                Попадает в очередь в киоске
              </div>
            </div>
            <Switch
              checked={draft.requires_visit}
              onCheckedChange={(v) => setDraft({ ...draft, requires_visit: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-ink-700 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активна</div>
              <div className="text-xs text-ink-400">
                Видна операторам и в киоске
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
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
