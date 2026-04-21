'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

const PUBLIC_PATHS = new Set(['/login']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Derive auth status from primitives to avoid useSyncExternalStore infinite-loop
  // (calling s.isAuthenticated() in the selector re-creates a closure on every render)
  const isAuthed = useAuthStore(
    (s) => !!s.token && !!s.expiresAt && s.expiresAt > Date.now(),
  );
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
