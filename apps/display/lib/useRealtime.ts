'use client';

import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Subscribe to the backend WebSocket and invalidate the given query keys on
 * every message — the socket is a refetch trigger, not a data channel.
 *
 * Only active against the real Django backend (NEXT_PUBLIC_USE_MSW=0); in mock
 * mode there is no WS server, so this no-ops and polling carries the app.
 * Auto-reconnects with capped exponential backoff.
 */
export function useRealtime(path: string, queryKeys: QueryKey[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MSW !== '0') return;
    if (typeof window === 'undefined') return;

    const base = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(`${base}${path}`);
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = () => {
        for (const key of queryKeys) qc.invalidateQueries({ queryKey: key });
      };
      ws.onclose = () => {
        if (closed) return;
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, 500 * 2 ** retry);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
    // queryKeys is a stable literal at each call site; path identifies the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, qc]);
}
