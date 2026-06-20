'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Hall } from '@queue/types';
import { Button } from '@/components/ui/button';
import { HallEditSheet } from '@/components/HallEditSheet';
import { useTr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

async function fetchHalls(): Promise<Hall[]> {
  const res = await fetch('/api/halls');
  return res.json();
}

export default function HallsPage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data: halls = [] } = useQuery({
    queryKey: ['halls'],
    queryFn: fetchHalls,
  });
  const [editing, setEditing] = useState<Hall | null>(null);
  const [creating, setCreating] = useState(false);

  const columns = useMemo<ColumnDef<Hall>[]>(
    () => [
      { key: 'code', accessor: (h) => h.code, filter: 'text' },
      {
        key: 'name',
        accessor: (h) => h.name_uz || h.name_ru,
        filter: 'text',
        filterValue: (h) => `${h.name_uz} ${h.name_ru} ${h.name_kaa}`,
      },
      {
        key: 'status',
        accessor: (h) => (h.is_active ? 'active' : 'inactive'),
        filter: 'select',
        options: [
          { value: 'active', label: tr('Faol', 'Belsendi') },
          { value: 'inactive', label: tr('Faol emas', 'Belsendi emes') },
        ],
      },
      { key: 'actions' },
    ],
    [tr],
  );
  // Keep default order by `order`; column-sort overrides it when activated.
  const sortedHalls = useMemo(
    () => halls.slice().sort((a, b) => a.order - b.order),
    [halls],
  );
  const ctl = useTableControls(sortedHalls, columns);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/halls/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['halls'] });
      toast.success(tr("Zal o'chirildi", 'Zal óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Zallar', 'Zallar')}</h1>
          <p className="mt-1 text-sm text-coal-3">
            {halls.length} {tr('ta zal', 'zal')}
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr('Zal yaratish', 'Zal jaratıw')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hair bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hair text-left text-xs uppercase tracking-wide text-coal-3">
              <Th ctl={ctl} col="code" className="px-6 py-3 font-medium">{tr('Kod', 'Kod')}</Th>
              <Th ctl={ctl} col="name" className="px-6 py-3 font-medium">{tr('Nomi', 'Atı')}</Th>
              <Th ctl={ctl} col="status" className="px-6 py-3 font-medium">{tr('Holati', 'Halatı')}</Th>
              <th className="px-6 py-3 font-medium text-right">{tr('Amallar', 'Ámeller')}</th>
            </tr>
            <FilterRow ctl={ctl} cellClassName="px-6" />
          </thead>
          <tbody>
            {ctl.view.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-hair/60 last:border-0 transition-colors hover:bg-hair/20"
                >
                  <td className="px-6 py-4 font-semibold text-coal">{h.code}</td>
                  <td className="px-6 py-4 text-coal">
                    {tr(h.name_uz || h.name_ru, h.name_kaa)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        h.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-hair/60 text-coal-3',
                      )}
                    >
                      {h.is_active ? tr('Faol', 'Belsendi') : tr('Faol emas', 'Belsendi emes')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(h)}
                        className="rounded-md p-1.5 text-coal-3 transition hover:bg-coral-soft hover:text-coral"
                        aria-label={tr('Tahrirlash', 'Redaktorlaw')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              tr(
                                `«${h.name_uz || h.name_ru}» zalini o'chirasizmi?`,
                                `«${h.name_kaa}» zalın óshirewdi qálaysız ba?`,
                              ),
                            )
                          ) {
                            deleteMut.mutate(h.id);
                          }
                        }}
                        className="rounded-md p-1.5 text-coal-3 transition hover:bg-coral-soft hover:text-coral"
                        aria-label={tr("O'chirish", 'Óshiriw')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {ctl.view.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-coal-3">
                  {halls.length === 0
                    ? tr("Hozircha zallar yo'q", 'Házirshe zallar joq')
                    : tr('Mos zal topilmadi', 'Sáykes zal tabılmadı')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <HallEditSheet
        hall={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <HallEditSheet
        hall={null}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
