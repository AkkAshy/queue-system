'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { localizedName, type Service, type ServiceCategory } from '@queue/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceEditSheet } from '@/components/ServiceEditSheet';
import { useTr, useLang } from '@/lib/i18n';
import { useTableControls, Th, FilterRow, type ColumnDef } from '@/lib/table-controls';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function ServicesPage() {
  const tr = useTr();
  const { lang } = useLang();
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success(tr("Xizmat o'chirildi", 'Xızmet óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  function codeOf(s: Service) {
    return categories.find((c) => c.id === s.category_id)?.code ?? '?';
  }

  const columns = useMemo<ColumnDef<Service>[]>(() => {
    const deliveryTypes = [...new Set(services.map((s) => s.delivery_type))];
    return [
      { key: 'id', accessor: (s) => s.id },
      {
        key: 'code',
        accessor: (s) => codeOf(s),
        filter: 'select',
        options: categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((c) => ({ value: c.code, label: `${c.code} · ${localizedName(c, lang)}` })),
      },
      {
        key: 'name',
        accessor: (s) => localizedName(s, lang),
        filter: 'text',
        filterValue: (s) => `${s.name_kaa} ${s.name_ru} ${s.name_uz ?? ''}`,
      },
      { key: 'sla', accessor: (s) => s.sla_days },
      {
        key: 'delivery',
        accessor: (s) => s.delivery_type,
        filter: 'select',
        options: deliveryTypes.map((v) => ({ value: v, label: v })),
      },
      {
        key: 'popular',
        accessor: (s) => (s.is_popular ? 'yes' : 'no'),
        filter: 'select',
        options: [
          { value: 'yes', label: tr('ha', 'awa') },
          { value: 'no', label: '—' },
        ],
      },
      {
        key: 'status',
        accessor: (s) => (s.is_active ? 'active' : 'inactive'),
        filter: 'select',
        options: [
          { value: 'active', label: tr('faol', 'belsendi') },
          { value: 'inactive', label: tr("o'chiq", 'óshik') },
        ],
      },
      { key: 'actions' },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, lang, categories, services]);
  const ctl = useTableControls(services, columns);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Xizmatlar', 'Xızmetler')}</h1>
          <p className="mt-1 text-sm text-coal-3">{services.length} {tr('ta yozuv', 'jazıw')}</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr('Yaratish', 'Jaratıw')}
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hair bg-card/40">
        {isLoading ? (
          <div className="p-8 text-sm text-coal-3">{tr('Yuklanmoqda…', 'Júklenbekte…')}</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <Th ctl={ctl} col="id" className="w-12">#</Th>
                <Th ctl={ctl} col="code" className="w-16">{tr('Kod', 'Kod')}</Th>
                <Th ctl={ctl} col="name">{tr('Nomi', 'Atı')}</Th>
                <Th ctl={ctl} col="sla" className="w-24">{tr('Muddat', 'Múddet')}</Th>
                <Th ctl={ctl} col="delivery" className="w-36">{tr('Berilishi', 'Beriliwi')}</Th>
                <Th ctl={ctl} col="popular" className="w-24">{tr('Ommabop', 'Ommabap')}</Th>
                <Th ctl={ctl} col="status" className="w-24">{tr('Holat', 'Halat')}</Th>
                <th className="w-16"></th>
              </tr>
              <FilterRow ctl={ctl} />
            </thead>
            <tbody>
              {ctl.view.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(s)}
                >
                  <td className="font-mono text-xs text-coal-3">{s.id}</td>
                  <td>
                    <span className="font-mono text-sm font-semibold text-coral-600">
                      {codeOf(s)}
                    </span>
                  </td>
                  <td className="max-w-[360px] truncate">{localizedName(s, lang)}</td>
                  <td className="font-mono text-sm">
                    {s.sla_days === 0 ? tr('darhol', 'derhal') : tr(`${s.sla_days} kun`, `${s.sla_days} kún`)}
                  </td>
                  <td className="font-mono text-xs text-coal-3">{s.delivery_type}</td>
                  <td>
                    {s.is_popular ? (
                      <Badge className="bg-coral/15 text-coral-600">{tr('ha', 'awa')}</Badge>
                    ) : (
                      <span className="text-coal-3">—</span>
                    )}
                  </td>
                  <td>
                    {s.is_active ? (
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(tr(`«${localizedName(s, lang)}» xizmatini o'chirasizmi?`, `«${localizedName(s, lang)}» xızmetin óshirewdi qálaysız ba?`))) {
                          deleteMut.mutate(s.id);
                        }
                      }}
                      className="rounded-md p-1.5 text-coal-3 transition hover:bg-coral-soft hover:text-coral"
                      aria-label={tr("O'chirish", 'Óshiriw')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ServiceEditSheet
        service={editing}
        categories={categories}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <ServiceEditSheet
        service={null}
        categories={categories}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
