'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { ServiceCategory } from '@queue/types';
import { cn } from '@/lib/utils';

interface Props {
  category: ServiceCategory;
  onClick?: () => void;
}

export function CategoryCard({ category, onClick }: Props) {
  const locale = useLocale();
  const name = locale === 'ru' ? category.name_ru : category.name_kaa;

  return (
    <Link
      href={`/${locale}/category/${category.code}`}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center',
        'min-h-[220px] touch-target transition-transform active:scale-95',
        'border-4 hover:brightness-110',
      )}
      style={{ borderColor: category.color, backgroundColor: `${category.color}22` }}
    >
      <div
        className="flex h-24 w-24 items-center justify-center rounded-2xl font-bold text-kiosk-lg"
        style={{ backgroundColor: category.color, color: '#0f172a' }}
      >
        {category.code}
      </div>
      <div className="text-2xl font-semibold leading-tight">{name}</div>
    </Link>
  );
}
