'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

const PUBLIC_PATHS = new Set(['/login']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.has(pathname);
    if (!isAuthed && !isPublic) {
      router.replace('/login');
      return;
    }
    if (isAuthed && pathname === '/login') {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [pathname, isAuthed, router]);

  if (!ready) return null;
  return <>{children}</>;
}
