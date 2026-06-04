'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Hall, Service, ServiceCategory } from '@queue/types';
import { CategoryCard } from '@/components/CategoryCard';
import { KioskHeader } from '@/components/KioskHeader';
import { categoryVisual } from '@/lib/category-visual';
import { useKioskStore } from '@/store/kiosk-store';

async function fetchHalls(): Promise<Hall[]> {
  const res = await fetch('/api/halls');
  if (!res.ok) throw new Error('Failed to load halls');
  return res.json();
}

async function fetchCategories(hallId: number): Promise<ServiceCategory[]> {
  const res = await fetch(`/api/categories?hall_id=${hallId}`);
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
  const th = useTranslations('hall');
  const locale = useLocale();
  const router = useRouter();
  const { hall, setHall, reset, setCategory, setService } = useKioskStore();

  const { data: halls } = useQuery({ queryKey: ['halls'], queryFn: fetchHalls });
  const { data: categories } = useQuery({
    queryKey: ['categories', hall?.id],
    queryFn: () => fetchCategories(hall!.id),
    enabled: !!hall,
  });
  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
    enabled: !!hall,
  });

  // ── Step 1: hall selection ──────────────────────────────────────────────
  if (!hall) {
    return (
      <main className="min-h-screen bg-cream" onMouseEnter={reset}>
        <KioskHeader />
        <section className="mx-auto max-w-4xl px-10 pb-16 pt-16 text-center">
          <span className="eyebrow text-coral">{th('eyebrow')}</span>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-coal">
            {th('title')}
          </h1>
          <div className="mt-12 grid grid-cols-2 gap-6">
            {(halls ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHall(h)}
                  className="paper paper-interactive flex flex-col items-center rounded-rxl px-8 py-12"
                >
                  <span className="flex h-24 w-24 items-center justify-center rounded-rlg bg-coral text-5xl font-extrabold text-white shadow-coral">
                    {h.code}
                  </span>
                  <span className="mt-5 text-3xl font-extrabold text-coal">
                    {locale === 'ru' ? h.name_ru : h.name_kaa}
                  </span>
                </button>
              ))}
          </div>
        </section>
      </main>
    );
  }

  // ── Step 2: categories of the chosen hall ───────────────────────────────
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const hallCatIds = new Set((categories ?? []).map((c) => c.id));
  const hallServices = (services ?? []).filter((s) => hallCatIds.has(s.category_id));

  const countByCat = new Map<number, number>();
  for (const s of hallServices) {
    countByCat.set(s.category_id, (countByCat.get(s.category_id) ?? 0) + 1);
  }
  const popular = hallServices.filter((s) => s.is_popular).slice(0, 6);

  const pickService = (s: Service) => {
    const cat = catById.get(s.category_id);
    if (!cat) return;
    setCategory(cat);
    setService(s);
    router.push(`/${locale}/confirm`);
  };

  const hallName = locale === 'ru' ? hall.name_ru : hall.name_kaa;

  return (
    <main className="min-h-screen bg-cream" onMouseEnter={reset}>
      <KioskHeader />

      <section className="mx-auto max-w-5xl px-10 pb-16 pt-10">
        <button
          onClick={() => setHall(null)}
          className="text-sm font-semibold text-coal-2 underline-offset-4 hover:text-coral hover:underline"
        >
          ← {th('change')}
        </button>
        <span className="eyebrow mt-4 block text-coral">{hallName}</span>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-coal">
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
                const name = locale === 'ru' ? s.name_ru : s.name_kaa;
                return (
                  <button
                    key={s.id}
                    onClick={() => pickService(s)}
                    className="paper paper-interactive flex items-center gap-4 rounded-r p-4 text-left"
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-rsm ${chip}`}>
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="line-clamp-2 font-semibold leading-snug text-coal">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* All categories */}
        <p className="eyebrow mt-12">{t('byCategory')}</p>
        <div className="mt-4 grid grid-cols-3 gap-4">
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
