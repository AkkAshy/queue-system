'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { Service, ServiceCategory } from '@queue/types';
import { Button } from '@/components/ui/button';
import { CategoryEditSheet } from '@/components/CategoryEditSheet';
import { useTr } from '@/lib/i18n';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}
async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  return res.json();
}

export default function CategoriesPage() {
  const tr = useTr();
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(tr("Kategoriya o'chirildi", 'Kategoriya óshirildi'));
    },
    onError: () => toast.error(tr("O'chirib bo'lmadi", 'Óshirip bolmadı')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <span className="eyebrow text-coral">{tr("Ma'lumotnoma", 'Maǵlıwmatnama')}</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{tr('Kategoriyalar', 'Kategoriyalar')}</h1>
          <p className="mt-1 text-sm text-coal-3">
            {categories.length} {tr('ta kategoriya · jami', 'kategoriya · jámi')} {services.length} {tr('ta xizmat', 'xızmet')}
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 bg-coral text-cream hover:bg-coral-600"
        >
          <Plus className="h-4 w-4" />
          {tr('Kategoriya yaratish', 'Kategoriya jaratıw')}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {categories
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((c) => {
            const count = services.filter((s) => s.category_id === c.id).length;
            return (
              <div
                key={c.id}
                onClick={() => setEditing(c)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-hair bg-card p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(tr(`«${c.name_ru}» kategoriyasini o'chirasizmi?`, `«${c.name_ru}» kategoriyasın óshirewdi qálaysız ba?`))) {
                        deleteMut.mutate(c.id);
                      }
                    }}
                    className="rounded-md p-1.5 text-coal-3 opacity-0 transition hover:bg-coral-soft hover:text-coral group-hover:opacity-100"
                    aria-label={tr("O'chirish", 'Óshiriw')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="my-7">
                  <span
                    className="text-6xl font-extrabold leading-none"
                    style={{ color: c.color }}
                  >
                    {c.code}
                  </span>
                </div>
                <div className="text-sm font-semibold text-coal">{c.name_ru}</div>
                <div className="mt-1 text-xs text-coal-3">{c.name_kaa}</div>
                <div className="mt-5 border-t border-hair pt-4 text-xs text-coal-3">
                  {count} {tr('ta xizmat', 'xızmet')}
                </div>
              </div>
            );
          })}
      </div>

      <CategoryEditSheet
        category={editing}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
      <CategoryEditSheet
        category={null}
        open={creating}
        onOpenChange={(v) => !v && setCreating(false)}
      />
    </div>
  );
}
