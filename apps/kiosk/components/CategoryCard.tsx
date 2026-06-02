'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { ServiceCategory } from '@queue/types';

interface Props {
  category: ServiceCategory;
}

export function CategoryCard({ category }: Props) {
  const locale = useLocale();
  const name = locale === 'ru' ? category.name_ru : category.name_kaa;

  return (
    <Link
      href={`/${locale}/category/${category.code}`}
      className="card-surface card-surface-interactive group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl p-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500/60"
    >
      {/* top tonal stripe — the only place the category color appears */}
      <span
        className="absolute inset-x-10 top-0 h-[3px] rounded-b-full opacity-75 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />

      <div className="flex items-start justify-between">
        <span
          className="eyebrow"
          style={{ color: category.color }}
        >
          {String(category.order).padStart(2, '0')} · {category.code}
        </span>
        <span
          className="mt-1 h-2 w-2 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
      </div>

      <div className="flex flex-1 items-center py-6">
        <span
          className="font-serif text-category-letter text-paper-100 transition-transform duration-300 group-hover:-translate-y-0.5"
          style={{ fontWeight: 400 }}
        >
          {category.code}
        </span>
      </div>

      <h3 className="font-sans text-lead font-medium leading-snug text-paper-100">
        {name}
      </h3>
    </Link>
  );
}
