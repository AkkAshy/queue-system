'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { Service, ServiceCategory } from '@queue/types';
import { ServiceRow } from '@/components/ServiceRow';
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

  return (
    <main className="min-h-screen p-12">
      <header className="mb-8 flex items-center gap-6">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="rounded-xl bg-muted px-6 py-4 text-xl font-medium text-muted-foreground"
        >
          ← {t('back')}
        </button>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-xl font-bold text-kiosk-md"
          style={{ backgroundColor: category.color, color: '#0f172a' }}
        >
          {category.code}
        </div>
        <h1 className="text-kiosk-md font-bold">{categoryName}</h1>
      </header>

      <div className="flex flex-col gap-4">
        {services?.map((s) => (
          <ServiceRow
            key={s.id}
            service={s}
            category={category}
            onClick={() => {
              setCategory(category);
              setService(s);
              router.push(`/${locale}/confirm`);
            }}
          />
        ))}
      </div>
    </main>
  );
}
