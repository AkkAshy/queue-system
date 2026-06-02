'use client';

let started = false;

export async function startMsw(): Promise<void> {
  if (started) return;
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_USE_MSW === '0') return;
  const { worker } = await import('@queue/mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  started = true;
}
