'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { LangSwitcher } from '@/components/layout/LangSwitcher';
import { useTr } from '@/lib/i18n';

export function TopBar() {
  const router = useRouter();
  // Use individual selectors to avoid object-literal identity issues in React 19
  const username = useAuthStore((s) => s.username);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const tr = useTr();

  function onLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-hair bg-cream/60 px-8 py-5 backdrop-blur">
      <div className="leading-tight">
        <span className="eyebrow text-coral">
          Ájiniyaz atındaǵı NDPI · Registrator ofisi
        </span>
      </div>

      <div className="flex items-center gap-4">
        <LangSwitcher />
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{username ?? '—'}</div>
          <div className="text-xs text-coal-3">{role ?? 'guest'}</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="gap-2 border-hair-2"
        >
          <LogOut className="h-3.5 w-3.5" />
          {tr('Chiqish', 'Shıǵıw')}
        </Button>
      </div>
    </header>
  );
}
