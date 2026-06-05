'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, Hall, User, UserRole } from '@queue/types';
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

const ROLES: { value: UserRole; uz: string; kaa: string }[] = [
  { value: 'admin',      uz: 'Administrator',   kaa: 'Administrator' },
  { value: 'hall_admin', uz: 'Zal boshlig\'i',  kaa: 'Zal basshısı' },
  { value: 'operator',   uz: 'Operator',        kaa: 'Operator' },
  { value: 'viewer',     uz: 'Kuzatuvchi',      kaa: 'Baqlawshı' },
];

interface Props {
  user: User | null;
  counters: Counter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<User, 'id'> & { id?: number; password?: string };

const EMPTY: Draft = {
  username: '',
  name: '',
  role: 'operator',
  counter_id: null,
  hall_id: null,
  is_active: true,
  password: '',
};

export function OperatorEditSheet({ user, counters, open, onOpenChange }: Props) {
  const tr = useTr();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(user ?? EMPTY);
  const { data: halls = [] } = useQuery<Hall[]>({
    queryKey: ['halls'],
    queryFn: async () => (await fetch('/api/halls')).json(),
  });

  useEffect(() => setDraft(user ?? EMPTY), [user]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/users' : `/api/users/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      // Send `password` only when the chief actually typed one — an empty field
      // on edit means "leave the password untouched".
      const { password, ...rest } = d;
      const body = password ? { ...rest, password } : rest;
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as User;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(draft.id ? tr('Operator yangilandi', 'Operator jańalandı') : tr('Operator yaratildi', 'Operator jaratıldı'));
      onOpenChange(false);
    },
    onError: () => toast.error(tr("Saqlab bo'lmadi", 'Saqlap bolmadı')),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {user ? tr(`Foydalanuvchi #${user.id}`, `Paydalanıwshı #${user.id}`) : tr('Yangi operator', 'Jańa operator')}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            {tr('Tizimda ishlash uchun hisob', 'Sistemada islew ushın esap')}
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">{tr('Login', 'Login')}</Label>
            <Input
              id="username"
              value={draft.username}
              onChange={(e) =>
                setDraft({ ...draft, username: e.target.value.toLowerCase() })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{tr('Ism', 'Atı')}</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{tr('Rol', 'Lawazım')}</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {tr(r.uz, r.kaa)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Counter select shown only for operators */}
          {draft.role === 'operator' && (
            <div className="space-y-2">
              <Label>{tr('Oyna', 'Áyne')}</Label>
              <Select
                value={draft.counter_id ? String(draft.counter_id) : 'none'}
                onValueChange={(v) =>
                  setDraft({ ...draft, counter_id: v === 'none' ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr('— tayinlanmagan —', '— tayınlanbaǵan —')}</SelectItem>
                  {counters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      №{c.number} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Hall select — for the head of a hall (hall_admin) */}
          {draft.role === 'hall_admin' && (
            <div className="space-y-2">
              <Label>{tr('Zal', 'Zal')}</Label>
              <Select
                value={draft.hall_id ? String(draft.hall_id) : 'none'}
                onValueChange={(v) =>
                  setDraft({ ...draft, hall_id: v === 'none' ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr('— tanlanmagan —', '— saylanbaǵan —')}</SelectItem>
                  {halls.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {tr(h.name_uz || h.name_ru, h.name_kaa)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">{tr('Faol', 'Belsendi')}</div>
              <div className="text-xs text-coal-3">
                {tr('Tizimga kira oladi', 'Sistemaǵa kire aladı')}
              </div>
            </div>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              {user ? tr('Yangi parol', 'Jańa parol') : tr('Parol', 'Parol')}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={user ? tr("bo'sh qoldiring — o'zgartirilmaydi", 'bos qaldırıń — ózgermeydi') : tr('standart: operator', 'standart: operator')}
              value={draft.password ?? ''}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <p className="text-xs text-coal-3">
              {user
                ? tr("Ushbu hisob parolini tiklash uchun to'ldiring.", 'Usı esap parolın tiklew ushın toltırıń.')
                : tr("Bo'sh qoldirish mumkin — u holda parol «operator» bo'ladi.", 'Bos qaldırıw múmkin — onda parol «operator» boladı.')}
            </p>
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
