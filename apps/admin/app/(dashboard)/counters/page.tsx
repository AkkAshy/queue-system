'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, Service } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CounterEditSheet } from '@/components/CounterEditSheet';
import { useTr } from '@/lib/i18n';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CountersPage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data: counters = [] } = useQuery({
    queryKey: ['counters'],
    queryFn: fetchCounters,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const [editing, setEditing] = useState<Counter | null>(null);
  const [creating, setCreating] = useState(false);

  const columns = useMemo<ColumnDef<Counter>[]>(
    () => [
      { key: 'number', accessor: (c) => c.number, filter: 'text' },
      { key: 'name', accessor: (c) => c.name, filter: 'text' },
      { key: 'services', accessor: (c) => c.service_ids.length },
      {
        key: 'status',
        accessor: (c) => (c.is_active ? 'active' : 'inactive'),
        filter: 'select',
        options: [
          { value: 'active', label: tr('faol', 'belsendi') },
          { value: 'inactive', label: tr("o'chiq", 'óshik') },
        ],
      },
      { key: 'actions' },
    ],
    [tr],
  );
  const ctl = useTableControls(counters, columns);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/counters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counters'] });
      toast.success(tr("Oyna o'chirildi", 'Áyne óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Oynalar', 'Áyneler')}</h1>
          <p className="mt-1 text-sm text-coal-3">{counters.length} {tr("ta ish o'rni", 'jumıs ornı')}</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr('Oyna yaratish', 'Áyne jaratıw')}
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hair bg-card/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <Th ctl={ctl} col="number" className="w-20">№</Th>
              <Th ctl={ctl} col="name">{tr('Nomi', 'Atı')}</Th>
              <Th ctl={ctl} col="services" className="w-32">{tr('Xizmatlar', 'Xızmetler')}</Th>
              <Th ctl={ctl} col="status" className="w-28">{tr('Holat', 'Halat')}</Th>
              <th className="w-32"></th>
            </tr>
            <FilterRow ctl={ctl} />
          </thead>
          <tbody>
            {ctl.view.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-lg font-semibold text-coral-600">
                  {c.number}
                </td>
                <td>{c.name}</td>
                <td className="font-mono text-sm text-coal-2">
                  {c.service_ids.length}
                </td>
                <td>
                  {c.is_active ? (
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
                      onClick={() => setEditing(c)}
                      className="gap-1.5 border-hair-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(tr(`№${c.number} oynani o'chirasizmi?`, `№${c.number} áynedi óshirewdi qálaysız ba?`))) {
                          deleteMut.mutate(c.id);
                        }
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

      {/* Edit sheet — opens with existing counter data */}
      <CounterEditSheet
        counter={editing}
        services={services}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      {/* Create sheet — always counter=null */}
      <CounterEditSheet
        counter={null}
        services={services}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
