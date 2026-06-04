'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

// Each language shows its own endonym — independent of the current locale.
const LANGS = [
  { code: 'kaa', label: 'Qaraqalpaqsha' },
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русча' },
  { code: 'en', label: 'English' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(code: string) {
    if (code === locale) return;
    const rest = pathname.replace(/^\/(kaa|ru|uz|en)/, '');
    router.push(`/${code}${rest || '/'}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-hair-2 p-1">
      {LANGS.map(({ code, label }) => {
        const active = code === locale;
        return (
          <button
            key={code}
            onClick={() => switchTo(code)}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'rounded-full bg-coral px-3.5 py-2 text-sm font-medium text-cream'
                : 'rounded-full px-3.5 py-2 text-sm font-medium text-coal-2 transition-colors duration-200 hover:text-coral'
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
