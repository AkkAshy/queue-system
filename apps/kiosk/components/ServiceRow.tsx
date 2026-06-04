'use client';

import { useLocale, useTranslations } from 'next-intl';
import { localizedName, type KioskLocale, type Service, type ServiceCategory } from '@queue/types';
import { categoryVisual } from '@/lib/category-visual';
import { cn } from '@/lib/utils';

interface Props {
  service: Service;
  category: ServiceCategory;
  onClick: () => void;
  index: number;
}

export function ServiceRow({ service, category, onClick }: Props) {
  const locale = useLocale() as KioskLocale;
  const t = useTranslations('category');
  const name = localizedName(service, locale);
  const disabled = !service.requires_visit;
  const { solid, text } = categoryVisual(category.code);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex w-full items-center gap-5 overflow-hidden rounded-r px-6 py-5 text-left touch-target',
        disabled
          ? 'cursor-not-allowed bg-cream-deep/60 opacity-60'
          : 'paper paper-interactive',
      )}
    >
      {!disabled && (
        <span
          className={cn('absolute left-0 top-4 h-[calc(100%-2rem)] w-1 rounded-r-full', solid)}
          aria-hidden
        />
      )}
      <div className="flex-1 pl-2">
        <div className="font-medium leading-snug text-coal">{name}</div>
        {disabled && <div className="mt-1.5 text-sm text-coal-3">{t('onlineHint')}</div>}
      </div>
      {!disabled && (
        <span
          className={cn('text-2xl transition-transform duration-200 group-hover:translate-x-1', text)}
          aria-hidden
        >
          →
        </span>
      )}
    </button>
  );
}
