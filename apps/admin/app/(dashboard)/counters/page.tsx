'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Counter, Service } from '@queue/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CounterEditSheet } from '@/components/CounterEditSheet';

async function fetchCounters(): Promise<Counter[]> {
  const res = await fetch('/api/counters');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CountersPage() {
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

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/counters/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counters'] });
      toast.success('Окно удалено');
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Окна</h1>
          <p className="mt-1 text-sm text-coal-3">{counters.length} рабочих мест</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          Создать окно
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hair bg-white/40">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th className="w-20">№</th>
              <th>Название</th>
              <th className="w-32">Услуг</th>
              <th className="w-28">Статус</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {counters.map((c) => (
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
                      активно
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-hair text-coal-3">
                      выкл
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
                        if (confirm(`Удалить окно №${c.number}?`)) {
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
