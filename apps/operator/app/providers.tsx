'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { startMsw } from '@/lib/msw';
import { installAuthFetch } from '@/lib/auth-fetch';
import { LangProvider } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(process.env.NODE_ENV !== 'development');

  useEffect(() => {
    installAuthFetch();
    if (process.env.NODE_ENV === 'development') {
      startMsw().then(() => setMswReady(true));
    }
  }, []);

  if (!mswReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-xs text-coal-3">
        …
      </div>
    );
  }

  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      <LangProvider>{children}</LangProvider>
      <Toaster theme="dark" position="top-center" duration={2500} />
    </QueryClientProvider>
  );
}
