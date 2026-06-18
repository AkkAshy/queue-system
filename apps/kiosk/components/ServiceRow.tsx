'use client';

import { useLocale } from 'next-intl';
import { localizedName, type KioskLocale, type Service, type ServiceCategory } from '@queue/types';
import { categoryVisual } from '@/lib/category-visual';
import { cn } from '@/lib/utils';

interface Props {
  service: Service;
  category: ServiceCategory;
  onClick: () => void;
  index: number;
}

// Every service is takeable at the kiosk — no online/HEMIS-only gating.
export function ServiceRow({ service, category, onClick }: Props) {
  const locale = useLocale() as KioskLocale;
  const name = localizedName(service, locale);
  const { solid, text } = categoryVisual(category.code);

  return (
    <button
      onClick={onClick}
      className="paper paper-interactive group relative flex w-full items-center gap-5 overflow-hidden rounded-r px-6 py-5 text-left touch-target"
    >
      <span
        className={cn('absolute left-0 top-4 h-[calc(100%-2rem)] w-1 rounded-r-full', solid)}
        aria-hidden
      />
      <div className="flex-1 pl-2">
        <div className="text-xl font-semibold leading-snug text-coal">{name}</div>
      </div>
      <span
        className={cn('text-3xl transition-transform duration-200 group-hover:translate-x-1', text)}
        aria-hidden
      >
        →
      </span>
    </button>
  );
}
