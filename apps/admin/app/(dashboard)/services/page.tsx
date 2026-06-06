'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { Service, ServiceCategory } from '@queue/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceEditSheet } from '@/components/ServiceEditSheet';
import { useTr } from '@/lib/i18n';

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
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter !== 'all' && s.category_id !== Number(categoryFilter)) return false;
      if (q && !`${s.name_kaa} ${s.name_ru}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, categoryFilter, search]);

  function codeOf(s: Service) {
    return categories.find((c) => c.id === s.category_id)?.code ?? '?';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Xizmatlar', 'Xızmetler')}</h1>
          <p className="mt-1 text-sm text-coal-3">{services.length} {tr('ta yozuv', 'jazıw')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={tr('Kategoriya', 'Kategoriya')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr('Barcha kategoriyalar', 'Barlıq kategoriyalar')}</SelectItem>
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
          <Input
            placeholder={tr('Qidirish…', 'Izlew…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 bg-coral text-cream hover:bg-coral-600"
          >
            <Plus className="h-4 w-4" />
            {tr('Yaratish', 'Jaratıw')}
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-hair bg-card/40">
        {isLoading ? (
          <div className="p-8 text-sm text-coal-3">{tr('Yuklanmoqda…', 'Júklenbekte…')}</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-16">{tr('Kod', 'Kod')}</th>
                <th>{tr('Nomi (ru)', 'Atı (ru)')}</th>
                <th className="w-24">{tr('Muddat', 'Múddet')}</th>
                <th className="w-36">{tr('Berilishi', 'Beriliwi')}</th>
                <th className="w-24">{tr('Ommabop', 'Ommabap')}</th>
                <th className="w-24">{tr('Holat', 'Halat')}</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
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
                  <td className="max-w-[360px] truncate">{s.name_ru}</td>
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
                        if (confirm(tr(`«${s.name_ru}» xizmatini o'chirasizmi?`, `«${s.name_ru}» xızmetin óshirewdi qálaysız ba?`))) {
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
