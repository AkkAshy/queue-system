'use client';

import { useLocale } from 'next-intl';
import type { Service, ServiceCategory } from '@queue/types';
import { cn } from '@/lib/utils';

interface Props {
  service: Service;
  category: ServiceCategory;
  onClick: () => void;
}

export function ServiceRow({ service, category, onClick }: Props) {
  const locale = useLocale();
  const name = locale === 'ru' ? service.name_ru : service.name_kaa;

  const disabled = !service.requires_visit;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-6 rounded-2xl border-4 p-6 text-left transition-transform',
        'touch-target',
        disabled
          ? 'cursor-not-allowed border-muted bg-muted/30 opacity-50'
          : 'active:scale-[0.98] hover:brightness-110',
      )}
      style={
        disabled
          ? undefined
          : { borderColor: category.color, backgroundColor: `${category.color}18` }
      }
    >
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl font-bold text-kiosk-md"
        style={{ backgroundColor: category.color, color: '#0f172a' }}
      >
        {category.code}
      </div>
      <div className="flex-1">
        <div className="text-2xl font-semibold leading-snug">{name}</div>
        {disabled && (
          <div className="mt-1 text-base text-muted-foreground">
            {locale === 'ru' ? 'Доступно онлайн — HEMIS' : 'Onlayn — HEMIS'}
          </div>
        )}
      </div>
    </button>
  );
}
