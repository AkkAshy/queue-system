'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ServiceCategory } from '@queue/types';
import { CategoryCard } from '@/components/CategoryCard';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
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
    <main
      className="min-h-screen p-12"
      onMouseEnter={reset} // coming back to home resets flow state
    >
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-kiosk-lg font-bold">{t('title')}</h1>
          <p className="mt-2 text-kiosk-md text-muted-foreground">{t('subtitle')}</p>
        </div>
        <LocaleSwitcher />
      </header>

      {isLoading && <div className="text-kiosk-md">…</div>}
      {isError && <div className="text-kiosk-md text-red-400">⚠</div>}

      {data && (
        <div className="grid grid-cols-3 gap-6">
          {data
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
        </div>
      )}
    </main>
  );
}
