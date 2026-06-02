'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Service, ServiceCategory } from '@queue/types';
import { cn } from '@/lib/utils';

interface Props {
  service: Service;
  category: ServiceCategory;
  onClick: () => void;
  index: number;
}

export function ServiceRow({ service, category, onClick, index }: Props) {
  const locale = useLocale();
  const t = useTranslations('category');
  const name = locale === 'ru' ? service.name_ru : service.name_kaa;
  const disabled = !service.requires_visit;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex w-full items-center gap-7 rounded-2xl px-7 py-6 text-left transition-all duration-200 touch-target',
        disabled
          ? 'cursor-not-allowed border border-ink-700/50 bg-ink-800/40 opacity-55'
          : 'card-surface card-surface-interactive',
      )}
    >
      {/* left tonal marker on active rows */}
      {!disabled && (
        <span
          className="absolute left-0 top-6 h-[calc(100%-3rem)] w-[3px] rounded-r-full"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
      )}

      <span className="font-mono text-eyebrow tabular-nums text-ink-400 w-10 shrink-0">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex-1">
        <div className="font-sans text-lead font-medium leading-snug text-paper-100">
          {name}
        </div>
        {disabled && (
          <div className="eyebrow mt-2 text-ink-400" style={{ letterSpacing: '0.15em' }}>
            {t('onlineHint')}
          </div>
        )}
      </div>

      {!disabled && (
        <span
          className="font-serif text-h3 text-ink-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-brass-400"
          aria-hidden
        >
          →
        </span>
      )}
    </button>
  );
}
