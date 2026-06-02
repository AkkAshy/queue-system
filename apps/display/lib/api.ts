import type { Counter, DisplayCall } from '@queue/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  getActiveCalls: () => fetch('/api/display/active').then(json<DisplayCall[]>),
  listCounters: () => fetch('/api/counters').then(json<Counter[]>),
};
