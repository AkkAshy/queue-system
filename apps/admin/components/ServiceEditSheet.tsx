'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Service, ServiceCategory, DeliveryType } from '@queue/types';
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
import { useTr } from '@/lib/i18n';

const DELIVERY_TYPES: DeliveryType[] = [
  'electron',
  'qagaz',
  'awizeki',
  'electron_qagaz',
  'electron_awizeki',
  'jiynalmali_papka',
];

interface Props {
  service: Service | null; // null = creating
  categories: ServiceCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<Service, 'id'> & { id?: number };

function emptyDraft(categories: ServiceCategory[]): Draft {
  return {
    category_id: categories[0]?.id ?? 0,
    name_kaa: '',
    name_ru: '',
    name_uz: '',
    name_en: '',
    sla_days: 0,
    delivery_type: 'electron',
    requires_visit: true,
    is_active: true,
    is_popular: false,
  };
}

export function ServiceEditSheet({ service, categories, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(service ?? emptyDraft(categories));

  useEffect(() => {
    setDraft(service ?? emptyDraft(categories));
  }, [service, categories]);

  const isCreate = !draft.id;

  const mutation = useMutation({
    mutationFn: async (s: Draft) => {
      const url = isCreate ? '/api/services' : `/api/services/${s.id}`;
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as Service;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(isCreate ? tr('Xizmat yaratildi', 'Xızmet jaratıldı') : tr('Saqlandi', 'Saqlandı'));
      onOpenChange(false);
    },
    onError: () => toast.error(tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  const canSave = !!draft.name_ru.trim() && !!draft.category_id && !mutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            {isCreate ? tr('Yangi xizmat', 'Jańa xızmet') : tr(`Xizmat #${draft.id}`, `Xızmet #${draft.id}`)}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {isCreate ? tr('Xizmat yaratish', 'Xızmet jaratıw') : tr('Xizmatni tahrirlash', 'Xızmetti redaktorlaw')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label>{tr('Kategoriya', 'Kategoriya')}</Label>
            <Select
              value={String(draft.category_id)}
              onValueChange={(v) => setDraft({ ...draft, category_id: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder={tr('Kategoriya', 'Kategoriya')} />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} · {c.name_ru}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
            <Label htmlFor="name_uz">{tr('Nomi (uz)', 'Atı (uz)')}</Label>
            <Input
              id="name_uz"
              value={draft.name_uz ?? ''}
              onChange={(e) => setDraft({ ...draft, name_uz: e.target.value })}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sla_days">{tr('Muddat (kun)', 'Múddet (kún)')}</Label>
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
              <Label>{tr('Berilish turi', 'Beriliw túri')}</Label>
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
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Tashrif talab qiladi', 'Keliwdi talap etedi')}</div>
              <div className="text-xs text-coal-3">{tr('Kioskdagi navbatga tushadi', 'Kioskdaǵı nóbetke túsedi')}</div>
            </div>
            <Switch
              checked={draft.requires_visit}
              onCheckedChange={(v) => setDraft({ ...draft, requires_visit: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Ommabop', 'Ommabap')}</div>
              <div className="text-xs text-coal-3">{tr("«Ommabop» blokida ko'rsatish", '«Ommabap» blogında kórsetiw')}</div>
            </div>
            <Switch
              checked={!!draft.is_popular}
              onCheckedChange={(v) => setDraft({ ...draft, is_popular: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Faol', 'Belsendi')}</div>
              <div className="text-xs text-coal-3">{tr("Operatorlarga va kioskda ko'rinadi", 'Operatorlarǵa hám kioskda kórinedi')}</div>
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
