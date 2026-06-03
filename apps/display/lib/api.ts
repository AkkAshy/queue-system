import type {
  Counter,
  DisplayBoardWindow,
  DisplayCall,
  DisplaySettings,
} from '@queue/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  getActiveCalls: () => fetch('/api/display/active').then(json<DisplayCall[]>),
  getBoard: () => fetch('/api/display/board').then(json<DisplayBoardWindow[]>),
  getSettings: () => fetch('/api/display/settings').then(json<DisplaySettings>),
  listCounters: () => fetch('/api/counters').then(json<Counter[]>),
};
