'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Light/Dark theme toggle. The no-flash inline script in the root layout sets
 * the initial `.dark` class on <html> from localStorage before paint; this
 * button just flips it and persists the choice. Theme variables live in the
 * shared tailwind preset (tailwind.preset.js).
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* storage blocked — theme still applies for this session */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Yorugʻ rejim' : 'Tungi rejim'}
      title={dark ? 'Yorugʻ rejim' : 'Tungi rejim'}
      className={
        'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-hair-2 text-coal-2 transition-colors hover:text-coral ' +
        className
      }
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
