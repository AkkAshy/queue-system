import type {
  Counter,
  DisplayBoardWindow,
  DisplayCall,
  DisplaySettings,
  DisplayWaiting,
} from '@queue/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// hall query suffix — scopes the board to one hall when ?hall= is set on the URL.
const hq = (hallId?: string | null) => (hallId ? `?hall_id=${hallId}` : '');

export const api = {
  getActiveCalls: (hallId?: string | null) =>
    fetch(`/api/display/active${hq(hallId)}`).then(json<DisplayCall[]>),
  getBoard: (hallId?: string | null) =>
    fetch(`/api/display/board${hq(hallId)}`).then(json<DisplayBoardWindow[]>),
  getWaiting: (hallId?: string | null) =>
    fetch(`/api/display/waiting${hq(hallId)}`).then(json<DisplayWaiting[]>),
  getSettings: () => fetch('/api/display/settings').then(json<DisplaySettings>),
  listCounters: () => fetch('/api/counters').then(json<Counter[]>),
};
