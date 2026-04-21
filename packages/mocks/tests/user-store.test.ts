import { describe, it, expect, beforeEach } from 'vitest';
import { UserStore } from '../src/user-store';

describe('UserStore', () => {
  let store: UserStore;
  beforeEach(() => {
    store = new UserStore([
      { id: 1, username: 'admin',    name: 'Admin', role: 'admin',    counter_id: null, is_active: true },
      { id: 2, username: 'operator', name: 'Op',    role: 'operator', counter_id: 1,    is_active: true },
    ]);
  });

  it('authenticates with correct credentials', () => {
    const u = store.authenticate('admin', 'admin');
    expect(u?.username).toBe('admin');
  });

  it('rejects wrong password', () => {
    expect(store.authenticate('admin', 'nope')).toBeUndefined();
  });

  it('rejects inactive users', () => {
    store.update(1, { is_active: false });
    expect(store.authenticate('admin', 'admin')).toBeUndefined();
  });

  it('create adds a user and returns it', () => {
    const u = store.create({
      username: 'new',
      name: 'New',
      role: 'viewer',
      counter_id: null,
      is_active: true,
    });
    expect(u.id).toBe(3);
    expect(store.list()).toHaveLength(3);
  });

  it('update mutates fields', () => {
    const u = store.update(1, { name: 'Admin 2' });
    expect(u?.name).toBe('Admin 2');
  });

  it('remove drops a user', () => {
    expect(store.remove(2)).toBe(true);
    expect(store.list()).toHaveLength(1);
  });
});
