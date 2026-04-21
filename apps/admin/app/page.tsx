'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export default function Root() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    router.replace(isAuthed ? '/dashboard' : '/login');
  }, [isAuthed, router]);

  return null;
}
