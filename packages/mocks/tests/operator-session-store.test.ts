import { describe, it, expect, beforeEach } from 'vitest';
import { OperatorSessionStore } from '../src/operator-session-store';

describe('OperatorSessionStore', () => {
  let store: OperatorSessionStore;
  beforeEach(() => {
    store = new OperatorSessionStore();
  });

  it('create returns a new active session with ids and timestamp', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    expect(s.id).toBe(1);
    expect(s.user_id).toBe(2);
    expect(s.counter_id).toBe(1);
    expect(s.status).toBe('active');
    expect(s.started_at).toBeTruthy();
    expect(s.ended_at).toBeNull();
  });

  it('create auto-increments session id', () => {
    const a = store.create({ user_id: 2, counter_id: 1 });
    const b = store.create({ user_id: 3, counter_id: 2 });
    expect(b.id).toBe(a.id + 1);
  });

  it('updateStatus flips to break and back', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    const broken = store.updateStatus(s.id, 'break')!;
    expect(broken.status).toBe('break');
    const back = store.updateStatus(s.id, 'active')!;
    expect(back.status).toBe('active');
  });

  it('updateStatus to ended sets ended_at', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    const ended = store.updateStatus(s.id, 'ended')!;
    expect(ended.status).toBe('ended');
    expect(ended.ended_at).not.toBeNull();
  });

  it('updateStatus returns null for unknown id', () => {
    expect(store.updateStatus(999, 'break')).toBeNull();
  });

  it('activeForCounter returns the active session or null', () => {
    const s = store.create({ user_id: 2, counter_id: 1 });
    expect(store.activeForCounter(1)?.id).toBe(s.id);
    store.updateStatus(s.id, 'ended');
    expect(store.activeForCounter(1)).toBeNull();
  });

  it('list returns all sessions', () => {
    store.create({ user_id: 2, counter_id: 1 });
    store.create({ user_id: 3, counter_id: 2 });
    expect(store.list()).toHaveLength(2);
  });
});
