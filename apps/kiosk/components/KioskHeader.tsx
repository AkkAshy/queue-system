'use client';

import { useTranslations } from 'next-intl';
import { Monogram } from './Monogram';
import { Clock } from './Clock';
import { LocaleSwitcher } from './LocaleSwitcher';

interface Props {
  /** When true, a thin brass separator line is rendered under the header */
  withDivider?: boolean;
}

export function KioskHeader({ withDivider = true }: Props) {
  const t = useTranslations('institution');

  return (
    <header className="flex items-center justify-between gap-8 px-12 pt-10 pb-7">
      <div className="flex items-center gap-5">
        <Monogram className="h-12 w-12 text-brass-500" />
        <div className="flex flex-col leading-none">
          <span className="eyebrow" style={{ color: '#C9A961' }}>
            {t('short')} · {t('office')}
          </span>
          <span className="mt-2 font-serif text-h3 font-normal text-paper-100">
            {t('full')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <Clock />
        <span className="h-10 w-px bg-ink-600" aria-hidden />
        <LocaleSwitcher />
      </div>

      {withDivider && (
        <div
          className="pointer-events-none absolute left-0 right-0 mt-[100px] h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(201,169,97,0.35) 20%, rgba(201,169,97,0.35) 80%, transparent 100%)',
          }}
          aria-hidden
        />
      )}
    </header>
  );
}
