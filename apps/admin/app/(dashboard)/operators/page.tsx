'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, User } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OperatorEditSheet } from '@/components/OperatorEditSheet';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  return res.json();
}
async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'админ',
  operator: 'оператор',
  viewer: 'наблюдатель',
};

export default function OperatorsPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const { data: counters = [] } = useQuery({
    queryKey: ['counters'],
    queryFn: fetchCounters,
  });

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Удалено');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  function counterLabel(id: number | null) {
    if (!id) return '—';
    const c = counters.find((x) => x.id === id);
    return c ? `№${c.number}` : '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-brass-500">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Операторы</h1>
          <p className="mt-1 text-sm text-ink-400">{users.length} учётных записей</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-brass-500 text-ink-900 hover:bg-brass-400"
        >
          <Plus className="h-4 w-4" />
          Создать оператора
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th className="w-32">Логин</th>
              <th>Имя</th>
              <th className="w-36">Роль</th>
              <th className="w-24">Окно</th>
              <th className="w-28">Статус</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-sm">{u.username}</td>
                <td>{u.name}</td>
                <td className="text-ink-300">{ROLE_LABEL[u.role]}</td>
                <td className="font-mono text-sm">{counterLabel(u.counter_id)}</td>
                <td>
                  {u.is_active ? (
                    <Badge variant="outline" className="border-ink-600 text-paper-100">
                      активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-ink-700 text-ink-500">
                      выкл
                    </Badge>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(u)}
                      className="gap-1.5 border-ink-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Удалить ${u.username}?`)) deleteMut.mutate(u.id);
                      }}
                      className="gap-1.5 border-ink-600 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Edit sheet — opens with existing user data */}
      <OperatorEditSheet
        user={editing}
        counters={counters}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      {/* Create sheet — always user=null */}
      <OperatorEditSheet
        user={null}
        counters={counters}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
