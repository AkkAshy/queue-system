'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, User } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OperatorEditSheet } from '@/components/OperatorEditSheet';
import { useTr } from '@/lib/i18n';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  return res.json();
}
async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}

const ROLE_LABEL: Record<string, { uz: string; kaa: string }> = {
  admin: { uz: 'administrator', kaa: 'administrator' },
  chief_admin: { uz: 'bosh administrator', kaa: 'bas administrator' },
  hall_admin: { uz: 'zal boshlig\'i', kaa: 'zal basshısı' },
  operator: { uz: 'operator', kaa: 'operator' },
  viewer: { uz: 'kuzatuvchi', kaa: 'baqlawshı' },
};

export default function OperatorsPage() {
  const tr = useTr();
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
      toast.success(tr("O'chirildi", 'Óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  function counterLabel(id: number | null) {
    if (!id) return '—';
    const c = counters.find((x) => x.id === id);
    return c ? `№${c.number}` : '—';
  }

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { key: 'username', accessor: (u) => u.username, filter: 'text' },
      { key: 'name', accessor: (u) => u.name, filter: 'text' },
      {
        key: 'role',
        accessor: (u) => u.role,
        filter: 'select',
        options: Object.entries(ROLE_LABEL).map(([value, l]) => ({
          value,
          label: tr(l.uz, l.kaa),
        })),
      },
      { key: 'counter', accessor: (u) => counterLabel(u.counter_id), filter: 'text' },
      {
        key: 'status',
        accessor: (u) => (u.is_active ? 'active' : 'inactive'),
        filter: 'select',
        options: [
          { value: 'active', label: tr('faol', 'belsendi') },
          { value: 'inactive', label: tr("o'chiq", 'óshik') },
        ],
      },
      { key: 'actions' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tr, counters],
  );
  const ctl = useTableControls(users, columns);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Operatorlar', 'Operatorlar')}</h1>
          <p className="mt-1 text-sm text-coal-3">{users.length} {tr('ta hisob', 'esap')}</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr('Operator yaratish', 'Operator jaratıw')}
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hair bg-card/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <Th ctl={ctl} col="username" className="w-32">{tr('Login', 'Login')}</Th>
              <Th ctl={ctl} col="name">{tr('Ism', 'Atı')}</Th>
              <Th ctl={ctl} col="role" className="w-36">{tr('Rol', 'Lawazım')}</Th>
              <Th ctl={ctl} col="counter" className="w-24">{tr('Oyna', 'Áyne')}</Th>
              <Th ctl={ctl} col="status" className="w-28">{tr('Holat', 'Halat')}</Th>
              <th className="w-32"></th>
            </tr>
            <FilterRow ctl={ctl} />
          </thead>
          <tbody>
            {ctl.view.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-sm">{u.username}</td>
                <td>{u.name}</td>
                <td className="text-coal-2">{(() => {
                  const lbl = ROLE_LABEL[u.role];
                  return lbl ? tr(lbl.uz, lbl.kaa) : u.role;
                })()}</td>
                <td className="font-mono text-sm">{counterLabel(u.counter_id)}</td>
                <td>
                  {u.is_active ? (
                    <Badge variant="outline" className="border-hair-2 text-coal">
                      {tr('faol', 'belsendi')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-hair text-coal-3">
                      {tr("o'chiq", 'óshik')}
                    </Badge>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(u)}
                      className="gap-1.5 border-hair-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(tr(`${u.username} o'chirilsinmi?`, `${u.username} óshirilsin be?`))) deleteMut.mutate(u.id);
                      }}
                      className="gap-1.5 border-hair-2 text-red-400 hover:text-red-300"
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
