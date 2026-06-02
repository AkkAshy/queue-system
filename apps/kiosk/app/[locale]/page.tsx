'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ServiceCategory } from '@queue/types';
import { CategoryCard } from '@/components/CategoryCard';
import { KioskHeader } from '@/components/KioskHeader';
import { useKioskStore } from '@/store/kiosk-store';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

export default function HomePage() {
  const t = useTranslations('welcome');
  const reset = useKioskStore((s) => s.reset);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <main className="relative min-h-screen bg-fade-top" onMouseEnter={reset}>
      <KioskHeader />

      <section className="px-12 pt-8 pb-16">
        <div className="mb-14 flex items-end justify-between gap-8">
          <div>
            <span className="eyebrow text-brass-400">{t('eyebrow')}</span>
            <h1 className="mt-4 font-serif text-h1 font-normal text-paper-100">
              {t('title')}
            </h1>
            <p className="mt-4 max-w-xl text-lead text-ink-300">{t('subtitle')}</p>
          </div>
          {data && (
            <div className="text-right">
              <div className="eyebrow">{data.length.toString().padStart(2, '0')}</div>
              <div className="mt-2 font-mono text-meta text-ink-400">categories</div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex min-h-[200px] items-center text-ink-400">
            <span className="font-mono text-meta tracking-wider">Loading…</span>
          </div>
        )}
        {isError && (
          <div className="flex min-h-[200px] items-center text-brass-500">
            <span className="font-mono text-meta tracking-wider">Failed to load</span>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-3 gap-5">
            {data
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <CategoryCard key={c.id} category={c} />
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
