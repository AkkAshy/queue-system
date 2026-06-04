import { describe, it, expect, beforeEach } from 'vitest';
import { useOperatorStore } from '@/store/operator-store';

describe('operator-store', () => {
  beforeEach(() => {
    useOperatorStore.getState().logout();
    sessionStorage.clear();
  });

  it('starts signed-out', () => {
    expect(useOperatorStore.getState().isSignedIn()).toBe(false);
  });

  it('startShift persists user + counter + session', () => {
    useOperatorStore.getState().startShift({
      token: 'tok',
      userId: 2,
      userName: 'Aygül',
      counterId: 1,
      counterNumber: '1',
      counterName: 'Окно 1',
      sessionId: 42,
    });
    const s = useOperatorStore.getState();
    expect(s.isSignedIn()).toBe(true);
    expect(s.userName).toBe('Aygül');
    expect(s.counterId).toBe(1);
    expect(s.sessionId).toBe(42);
  });

  it('logout clears everything', () => {
    useOperatorStore.getState().startShift({
      token: 'tok',
      userId: 2, userName: 'Aygül', counterId: 1,
      counterNumber: '1', counterName: 'Окно 1', sessionId: 42,
    });
    useOperatorStore.getState().logout();
    expect(useOperatorStore.getState().isSignedIn()).toBe(false);
    expect(useOperatorStore.getState().counterId).toBeNull();
  });

  it('setOnBreak toggles a flag', () => {
    useOperatorStore.getState().startShift({
      token: 'tok',
      userId: 2, userName: 'Aygül', counterId: 1,
      counterNumber: '1', counterName: 'Окно 1', sessionId: 42,
    });
    useOperatorStore.getState().setOnBreak(true);
    expect(useOperatorStore.getState().onBreak).toBe(true);
    useOperatorStore.getState().setOnBreak(false);
    expect(useOperatorStore.getState().onBreak).toBe(false);
  });
});
