'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { Service, ServiceCategory } from '@queue/types';
import { ServiceRow } from '@/components/ServiceRow';
import { KioskHeader } from '@/components/KioskHeader';
import { useKioskStore } from '@/store/kiosk-store';

async function fetchCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/categories');
  return res.json();
}

async function fetchServices(categoryId: number): Promise<Service[]> {
  const res = await fetch(`/api/services?category_id=${categoryId}`);
  return res.json();
}

export default function CategoryPage() {
  const params = useParams<{ code: string; locale: string }>();
  const t = useTranslations('category');
  const locale = useLocale();
  const router = useRouter();
  const { setCategory, setService } = useKioskStore();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });
  const category = categories?.find((c) => c.code === params.code);

  const { data: services } = useQuery({
    queryKey: ['services', category?.id],
    queryFn: () => fetchServices(category!.id),
    enabled: !!category,
  });

  if (!category) return null;
  const categoryName = locale === 'ru' ? category.name_ru : category.name_kaa;
  const activeServices = services?.filter((s) => s.requires_visit) ?? [];

  return (
    <main className="relative min-h-screen bg-fade-top">
      <KioskHeader />

      <section className="px-12 pt-4 pb-16">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="mb-10 inline-flex items-center gap-3 font-sans text-meta uppercase tracking-[0.15em] text-ink-300 transition-colors duration-200 hover:text-brass-400"
        >
          <span className="font-serif text-h3 leading-none">←</span>
          {t('back')}
        </button>

        <div className="mb-12 flex items-end justify-between gap-8 border-b border-ink-700 pb-8">
          <div className="flex items-start gap-8">
            <span
              className="font-serif text-display leading-none"
              style={{ color: category.color, fontWeight: 400 }}
            >
              {category.code}
            </span>
            <div>
              <span className="eyebrow" style={{ color: category.color }}>
                {t('eyebrow')} · {String(category.order).padStart(2, '0')}
              </span>
              <h1 className="mt-3 font-serif text-h1 font-normal text-paper-100">
                {categoryName}
              </h1>
            </div>
          </div>
          {services && (
            <div className="text-right">
              <div className="eyebrow">
                {t('serviceCount', { count: activeServices.length })}
              </div>
              <div className="mt-2 font-mono text-meta text-ink-400">
                / {services.length} total
              </div>
            </div>
          )}
        </div>

        <p className="eyebrow mb-6">{t('selectService')}</p>

        <div className="flex flex-col gap-3">
          {services?.map((s, i) => (
            <ServiceRow
              key={s.id}
              service={s}
              category={category}
              index={i}
              onClick={() => {
                setCategory(category);
                setService(s);
                router.push(`/${locale}/confirm`);
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
