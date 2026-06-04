'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName, type KioskLocale, type Service, type ServiceCategory } from '@queue/types';
import { ServiceRow } from '@/components/ServiceRow';
import { KioskHeader } from '@/components/KioskHeader';
import { categoryVisual } from '@/lib/category-visual';
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
  const locale = useLocale() as KioskLocale;
  const router = useRouter();
  const { setCategory, setService } = useKioskStore();

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const category = categories?.find((c) => c.code === params.code);

  const { data: services } = useQuery({
    queryKey: ['services', category?.id],
    queryFn: () => fetchServices(category!.id),
    enabled: !!category,
  });

  if (!category) return null;
  const categoryName = localizedName(category, locale);
  const { Icon, chip } = categoryVisual(category.code);

  return (
    <main className="min-h-screen bg-cream">
      <KioskHeader />

      <section className="mx-auto max-w-4xl px-10 pb-16 pt-6">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="mb-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-coal-2 shadow-soft transition-colors hover:text-coral"
        >
          <span className="text-lg leading-none">←</span>
          {t('back')}
        </button>

        <div className="mb-8 flex items-center gap-5">
          <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-rlg ${chip}`}>
            <Icon className="h-8 w-8" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-3xl font-bold leading-tight text-coal">{categoryName}</h1>
            {services && (
              <p className="mt-1 text-sm text-coal-3">
                {t('serviceCount', { count: services.length })}
              </p>
            )}
          </div>
        </div>

        <p className="eyebrow mb-4">{t('selectService')}</p>

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
