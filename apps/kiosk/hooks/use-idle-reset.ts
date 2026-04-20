import { useEffect, useRef } from 'react';

interface Options {
  timeoutMs: number;
  onIdle: () => void;
  enabled: boolean;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

export function useIdleReset({ timeoutMs, onIdle, enabled }: Options) {
  const cbRef = useRef(onIdle);
  cbRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => cbRef.current(), timeoutMs);

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs, enabled]);
}
