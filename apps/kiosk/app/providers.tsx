'use client';

import { QueryClientProvider } from '@tanstack/react-query';
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

  const client = getQueryClient();

  if (!mswReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-kiosk-md">
        …
      </div>
    );
  }

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
