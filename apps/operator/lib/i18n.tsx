'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Staff apps are bilingual: Uzbek (default) ⇄ Karakalpak. Lightweight inline
// i18n — no routing, no message files. Strings are written as `tr(uz, kaa)` at
// the call site; the active language is persisted in localStorage.
export type StaffLocale = 'uz' | 'kaa';

const STORAGE_KEY = 'operator-lang';

interface LangCtx {
  lang: StaffLocale;
  setLang: (l: StaffLocale) => void;
}

const Ctx = createContext<LangCtx>({ lang: 'uz', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<StaffLocale>('uz');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'uz' || saved === 'kaa') setLangState(saved);
  }, []);

  const setLang = (l: StaffLocale) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

/** Returns a `tr(uz, kaa)` picker bound to the active language. */
export function useTr() {
  const { lang } = useLang();
  return (uz: string, kaa: string) => (lang === 'kaa' ? kaa : uz);
}
