'use client';

let started = false;

export async function startMsw(): Promise<void> {
  if (started) return;
  if (typeof window === 'undefined') return;

  const { worker } = await import('@queue/mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  started = true;
}
