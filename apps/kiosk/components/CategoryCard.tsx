'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ServiceCategory } from '@queue/types';
import { categoryVisual } from '@/lib/category-visual';

interface Props {
  category: ServiceCategory;
  count: number;
}

export function CategoryCard({ category, count }: Props) {
  const locale = useLocale();
  const t = useTranslations('category');
  const name = locale === 'ru' ? category.name_ru : category.name_kaa;
  const { Icon, chip } = categoryVisual(category.code);

  return (
    <Link
      href={`/${locale}/category/${category.code}`}
      className="paper paper-interactive flex items-center gap-4 rounded-r p-5"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-rsm ${chip}`}>
        <Icon className="h-6 w-6" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold leading-snug text-coal">{name}</div>
        <div className="mt-0.5 text-sm text-coal-3">
          {t('serviceCount', { count })}
        </div>
      </div>
    </Link>
  );
}
