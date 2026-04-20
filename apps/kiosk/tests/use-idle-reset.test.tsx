import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleReset } from '@/hooks/use-idle-reset';

describe('useIdleReset', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires callback after timeout when no activity', () => {
    const cb = vi.fn();
    renderHook(() => useIdleReset({ timeoutMs: 1000, onIdle: cb, enabled: true }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const cb = vi.fn();
    renderHook(() => useIdleReset({ timeoutMs: 1000, onIdle: cb, enabled: false }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('resets the timer on pointerdown', () => {
    const cb = vi.fn();
    renderHook(() => useIdleReset({ timeoutMs: 1000, onIdle: cb, enabled: true }));
    act(() => {
      vi.advanceTimersByTime(700);
      window.dispatchEvent(new PointerEvent('pointerdown'));
      vi.advanceTimersByTime(700);
    });
    expect(cb).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
