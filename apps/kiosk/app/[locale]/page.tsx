'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { localizedName, type KioskLocale, type Service, type ServiceCategory } from '@queue/types';
import { CategoryCard } from '@/components/CategoryCard';
import { KioskHeader } from '@/components/KioskHeader';
import { categoryVisual } from '@/lib/category-visual';
import { useKioskStore } from '@/store/kiosk-store';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

async function fetchServices(): Promise<Service[]> {
  const res = await fetch('/api/services');
  if (!res.ok) throw new Error('Failed to load services');
  return res.json();
}

export default function HomePage() {
  const t = useTranslations('welcome');
  const locale = useLocale() as KioskLocale;
  const router = useRouter();
  const { reset, setCategory, setService } = useKioskStore();

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: fetchServices });

  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const countByCat = new Map<number, number>();
  for (const s of services ?? []) {
    countByCat.set(s.category_id, (countByCat.get(s.category_id) ?? 0) + 1);
  }
  const popular = (services ?? []).filter((s) => s.is_popular).slice(0, 6);

  const pickService = (s: Service) => {
    const cat = catById.get(s.category_id);
    if (!cat) return;
    setCategory(cat);
    setService(s);
    router.push(`/${locale}/confirm`);
  };

  return (
    <main className="min-h-screen bg-cream" onMouseEnter={reset}>
      <KioskHeader />

      <section className="mx-auto max-w-5xl px-10 pb-16 pt-10">
        <span className="eyebrow text-coral">{t('eyebrow')}</span>
        <h1 className="mt-3 text-6xl font-extrabold tracking-tight text-coal">
          {t('title')}
        </h1>

        {/* Popular — one tap */}
        {popular.length > 0 && (
          <>
            <p className="eyebrow mt-10">{t('popular')}</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {popular.map((s) => {
                const cat = catById.get(s.category_id);
                const { Icon, chip } = categoryVisual(cat?.code ?? '');
                const name = localizedName(s, locale);
                return (
                  <button
                    key={s.id}
                    onClick={() => pickService(s)}
                    className="paper paper-interactive flex items-center gap-4 rounded-r p-5 text-left touch-target"
                  >
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-rsm ${chip}`}>
                      <Icon className="h-7 w-7" strokeWidth={2} />
                    </span>
                    <span className="line-clamp-2 text-xl font-semibold leading-snug text-coal">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* All categories — one per row (full width, names never truncate) */}
        <p className="eyebrow mt-12">{t('byCategory')}</p>
        <div className="mt-4 grid grid-cols-1 gap-3">
          {(categories ?? [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((c) => (
              <CategoryCard key={c.id} category={c} count={countByCat.get(c.id) ?? 0} />
            ))}
        </div>
      </section>
    </main>
  );
}
