import { useAuthStore } from '@/store/auth-store';

let installed = false;

/**
 * Patch window.fetch once so every same-origin /api/ request carries the JWT
 * from the auth store. Keeps the scattered `fetch('/api/...')` calls in pages
 * working under backend auth enforcement without touching each one.
 * (In dev, MSW intercepts /api and ignores the header — harmless.)
 */
export function installAuthFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;
    if (url && (url.startsWith('/api/') || url.includes('/api/'))) {
      const token = useAuthStore.getState().token;
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }
    return orig(input, init);
  };
}
