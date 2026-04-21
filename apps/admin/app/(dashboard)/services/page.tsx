'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ServiceEditSheet } from '@/components/ServiceEditSheet';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function ServicesPage() {
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
          <span className="eyebrow text-brass-500">Справочник</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Услуги</h1>
          <p className="mt-1 text-sm text-ink-400">{services.length} записей</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} · {c.name_ru}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40">
        {isLoading ? (
          <div className="p-8 text-sm text-ink-400">Загрузка…</div>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th className="w-16">Код</th>
                <th>Название (kaa)</th>
                <th>Название (ru)</th>
                <th className="w-24">Срок</th>
                <th className="w-36">Выдача</th>
                <th className="w-28">В очереди</th>
                <th className="w-24">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(s)}
                >
                  <td className="font-mono text-xs text-ink-400">{s.id}</td>
                  <td>
                    <span className="font-mono text-sm font-semibold text-brass-400">
                      {codeOf(s)}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate">{s.name_kaa}</td>
                  <td className="max-w-[260px] truncate text-ink-300">{s.name_ru}</td>
                  <td className="font-mono text-sm">
                    {s.sla_days === 0 ? 'сразу' : `${s.sla_days} д.`}
                  </td>
                  <td className="font-mono text-xs text-ink-400">{s.delivery_type}</td>
                  <td>
                    {s.requires_visit ? (
                      <Badge className="bg-brass-500/15 text-brass-400">да</Badge>
                    ) : (
                      <Badge variant="outline" className="border-ink-600 text-ink-400">
                        нет
                      </Badge>
                    )}
                  </td>
                  <td>
                    {s.is_active ? (
                      <Badge variant="outline" className="border-ink-600 text-paper-100">
                        активна
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-ink-700 text-ink-500">
                        выкл
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ServiceEditSheet
        service={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
