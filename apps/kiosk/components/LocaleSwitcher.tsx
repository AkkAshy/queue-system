'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('locale');
  const router = useRouter();
  const pathname = usePathname();
  const next = locale === 'kaa' ? 'ru' : 'kaa';

  function switchTo() {
    const rest = pathname.replace(/^\/(kaa|ru)/, '');
    router.push(`/${next}${rest || '/'}`);
  }

  return (
    <button
      onClick={switchTo}
      className="group flex items-center gap-2.5 rounded-full border border-hair-2 px-5 py-2.5 text-sm font-medium tracking-wide text-coal-2 transition-colors duration-200 hover:border-coral hover:text-coral"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-coral transition-transform duration-200 group-hover:scale-125"
        aria-hidden
      />
      {t('switch')}
    </button>
  );
}
