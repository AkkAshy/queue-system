'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName, type KioskLocale, type ServiceCategory } from '@queue/types';
import { categoryVisual } from '@/lib/category-visual';

interface Props {
  category: ServiceCategory;
  count: number;
}

export function CategoryCard({ category, count }: Props) {
  const locale = useLocale() as KioskLocale;
  const t = useTranslations('category');
  const name = localizedName(category, locale);
  const { Icon, chip } = categoryVisual(category.code);

  return (
    <Link
      href={`/${locale}/category/${category.code}`}
      className="paper paper-interactive flex items-center gap-5 rounded-r p-6 touch-target"
    >
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-rsm ${chip}`}>
        <Icon className="h-8 w-8" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-2xl font-bold leading-snug text-coal">{name}</div>
        <div className="mt-1 text-base text-coal-3">
          {t('serviceCount', { count })}
        </div>
      </div>
    </Link>
  );
}
