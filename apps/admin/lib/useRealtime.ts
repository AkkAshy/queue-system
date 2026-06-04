'use client';

import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';

/**
 * Subscribe to the backend WebSocket and invalidate the given query keys on
 * every message — the socket is a refetch trigger, not a data channel.
 *
 * The `/ws/admin` group is auth-protected server-side, so the JWT goes in the
 * `token` query param (browsers can't set WS headers). Reconnects when the
 * token changes (login/logout).
 *
 * Only active against the real Django backend (NEXT_PUBLIC_USE_MSW=0); in mock
 * mode there is no WS server, so this no-ops and polling carries the app.
 * Auto-reconnects with capped exponential backoff.
 */
export function useRealtime(path: string, queryKeys: QueryKey[]) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MSW !== '0') return;
    if (typeof window === 'undefined') return;

    const base = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';
    const url = token
      ? `${base}${path}?token=${encodeURIComponent(token)}`
      : `${base}${path}`;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(url);
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
    // queryKeys is a stable literal at each call site; path+token identify the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, qc, token]);
}
