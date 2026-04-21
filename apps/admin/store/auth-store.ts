import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRole, LoginResponse } from '@queue/types';

interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole | null;
  expiresAt: number | null; // unix ms

  loginSuccess: (resp: LoginResponse) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      role: null,
      expiresAt: null,

      loginSuccess: (resp) =>
        set({
          token: resp.token,
          username: resp.username,
          role: resp.role,
          expiresAt: new Date(resp.expires_at).getTime(),
        }),

      logout: () => set({ token: null, username: null, role: null, expiresAt: null }),

      isAuthenticated: () => {
        const s = get();
        if (!s.token || !s.expiresAt) return false;
        return s.expiresAt > Date.now();
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? (undefined as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
