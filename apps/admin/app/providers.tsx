'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { startMsw } from '@/lib/msw';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(process.env.NODE_ENV !== 'development');

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      startMsw().then(() => setMswReady(true));
    }
  }, []);

  if (!mswReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-coal-3">
        …
      </div>
    );
  }

  const client = getQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
