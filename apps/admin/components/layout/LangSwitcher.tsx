'use client';

import { useLang, type StaffLocale } from '@/lib/i18n';

const LANGS: { code: StaffLocale; label: string }[] = [
  { code: 'kaa', label: 'Qaraqalpaqsha' },
  { code: 'uz', label: "O'zbekcha" },
];

export function LangSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex items-center gap-1 rounded-full border border-hair-2 p-0.5">
      {LANGS.map(({ code, label }) => {
        const active = code === lang;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'rounded-full bg-coral px-3 py-1.5 text-xs font-medium text-cream'
                : 'rounded-full px-3 py-1.5 text-xs font-medium text-coal-2 transition-colors hover:text-coral'
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
