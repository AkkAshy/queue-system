import { useOperatorStore } from '@/store/operator-store';

let installed = false;

/**
 * Patch window.fetch once so /api/ requests carry the operator's JWT (obtained
 * at login). Harmless under the currently-open operator endpoints; ready for
 * when operator actions get enforced. (MSW ignores the header in dev.)
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
    if (url && url.includes('/api/')) {
      const token = useOperatorStore.getState().token;
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
