import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ServiceCategory, Service, Ticket } from '@queue/types';

interface KioskState {
  category: ServiceCategory | null;
  service: Service | null;
  ticket: Ticket | null;
  idempotencyKey: string | null;

  setCategory: (c: ServiceCategory | null) => void;
  setService: (s: Service | null) => void;
  setTicket: (t: Ticket | null) => void;
  prepareIdempotencyKey: () => string;
  reset: () => void;
}

// Persist flow state across navigations within a session.
// sessionStorage clears naturally when the browser closes — good fit for a
// kiosk that resets per working day (no stale ticket IDs survive reboots).
export const useKioskStore = create<KioskState>()(
  persist(
    (set, get) => ({
      category: null,
      service: null,
      ticket: null,
      idempotencyKey: null,

      setCategory: (category) => set({ category }),
      setService: (service) => set({ service }),
      setTicket: (ticket) => set({ ticket }),

      prepareIdempotencyKey: () => {
        const existing = get().idempotencyKey;
        if (existing) return existing;
        const key = crypto.randomUUID();
        set({ idempotencyKey: key });
        return key;
      },

      reset: () =>
        set({ category: null, service: null, ticket: null, idempotencyKey: null }),
    }),
    {
      name: 'kiosk-flow',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? (undefined as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
