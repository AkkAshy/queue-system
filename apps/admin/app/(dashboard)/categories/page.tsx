'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Service, ServiceCategory } from '@queue/types';
import { CategoryEditSheet } from '@/components/CategoryEditSheet';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CategoriesPage() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });
  const [editing, setEditing] = useState<ServiceCategory | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <span className="eyebrow text-brass-500">Справочник</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Категории</h1>
        <p className="mt-1 text-sm text-ink-400">
          {categories.length} категорий · {services.length} услуг всего
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const count = services.filter((s) => s.category_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setEditing(c)}
                className="group relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-800/40 p-6 text-left transition-all duration-200 hover:border-ink-600 hover:bg-ink-800/70"
              >
                <span
                  className="absolute inset-x-6 top-0 h-[3px] rounded-b-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className="eyebrow" style={{ color: c.color }}>
                    {String(c.order).padStart(2, '0')} · {c.code}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                </div>
                <div className="my-8">
                  <span
                    className="font-serif text-6xl leading-none"
                    style={{ color: '#F5F1E8', fontWeight: 400 }}
                  >
                    {c.code}
                  </span>
                </div>
                <div className="text-sm font-medium text-paper-100">{c.name_ru}</div>
                <div className="mt-1 text-xs text-ink-400">{c.name_kaa}</div>
                <div className="mt-5 border-t border-ink-700 pt-4 text-xs text-ink-400">
                  {count} услуг
                </div>
              </button>
            );
          })}
      </div>

      <CategoryEditSheet
        category={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
