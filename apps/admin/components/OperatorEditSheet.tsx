'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Counter, User, UserRole } from '@queue/types';
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

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin',    label: 'Администратор' },
  { value: 'operator', label: 'Оператор' },
  { value: 'viewer',   label: 'Наблюдатель' },
];

interface Props {
  user: User | null;
  counters: Counter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Omit<User, 'id'> & { id?: number };

const EMPTY: Draft = {
  username: '',
  name: '',
  role: 'operator',
  counter_id: null,
  is_active: true,
};

export function OperatorEditSheet({ user, counters, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(user ?? EMPTY);

  useEffect(() => setDraft(user ?? EMPTY), [user]);

  const mutation = useMutation({
    mutationFn: async (d: Draft) => {
      const isCreate = !d.id;
      const url = isCreate ? '/api/users' : `/api/users/${d.id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) throw new Error('save failed');
      return (await res.json()) as User;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(draft.id ? 'Оператор обновлён' : 'Оператор создан');
      onOpenChange(false);
    },
    onError: () => toast.error('Не удалось сохранить'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-cream text-coal">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl font-normal">
            {user ? `Пользователь #${user.id}` : 'Новый оператор'}
          </SheetTitle>
          <SheetDescription className="text-coal-3">
            Учётная запись для работы в системе
          </SheetDescription>
        </SheetHeader>

        <div className="my-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Логин</Label>
            <Input
              id="username"
              value={draft.username}
              onChange={(e) =>
                setDraft({ ...draft, username: e.target.value.toLowerCase() })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Роль</Label>
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
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Counter select shown only for operators */}
          {draft.role === 'operator' && (
            <div className="space-y-2">
              <Label>Окно</Label>
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
                  <SelectItem value="none">— не назначено —</SelectItem>
                  {counters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      №{c.number} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-hair px-4 py-3">
            <div>
              <div className="text-sm font-medium">Активен</div>
              <div className="text-xs text-coal-3">
                Может входить в систему
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
            className="bg-coral text-cream hover:bg-coral-600"
          >
            {mutation.isPending ? '…' : 'Сохранить'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
