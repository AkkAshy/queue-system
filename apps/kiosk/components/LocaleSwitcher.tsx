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
      className="rounded-xl bg-muted px-6 py-4 text-xl font-medium text-muted-foreground hover:bg-muted/80"
    >
      {t('switch')}
    </button>
  );
}
