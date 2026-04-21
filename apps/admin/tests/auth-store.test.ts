import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth-store';

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('loginSuccess stores token and flips isAuthenticated', () => {
    useAuthStore.getState().loginSuccess({
      token: 'dev.admin.123',
      username: 'admin',
      role: 'admin',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(useAuthStore.getState().username).toBe('admin');
  });

  it('logout clears state', () => {
    useAuthStore.getState().loginSuccess({
      token: 'x', username: 'admin', role: 'admin',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('isAuthenticated returns false for expired tokens', () => {
    useAuthStore.getState().loginSuccess({
      token: 'x', username: 'admin', role: 'admin',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});
