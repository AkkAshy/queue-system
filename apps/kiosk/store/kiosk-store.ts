import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Hall, ServiceCategory, Service, Ticket } from '@queue/types';
import { safeUUID } from '@/lib/uuid';

interface KioskState {
  hall: Hall | null;
  category: ServiceCategory | null;
  service: Service | null;
  ticket: Ticket | null;
  idempotencyKey: string | null;
  // true when the ticket was queued but the printer didn't accept the job —
  // the ticket page then asks the student to remember their number.
  printFailed: boolean;

  setHall: (h: Hall | null) => void;
  setCategory: (c: ServiceCategory | null) => void;
  setService: (s: Service | null) => void;
  setTicket: (t: Ticket | null) => void;
  setPrintFailed: (v: boolean) => void;
  prepareIdempotencyKey: () => string;
  reset: () => void;
}

// Persist flow state across navigations within a session.
// sessionStorage clears naturally when the browser closes — good fit for a
// kiosk that resets per working day (no stale ticket IDs survive reboots).
export const useKioskStore = create<KioskState>()(
  persist(
    (set, get) => ({
      hall: null,
      category: null,
      service: null,
      ticket: null,
      idempotencyKey: null,
      printFailed: false,

      setHall: (hall) => set({ hall }),
      setCategory: (category) => set({ category }),
      setService: (service) => set({ service }),
      setTicket: (ticket) => set({ ticket }),
      setPrintFailed: (printFailed) => set({ printFailed }),

      prepareIdempotencyKey: () => {
        const existing = get().idempotencyKey;
        if (existing) return existing;
        const key = safeUUID();
        set({ idempotencyKey: key });
        return key;
      },

      reset: () =>
        set({
          hall: null,
          category: null,
          service: null,
          ticket: null,
          idempotencyKey: null,
          printFailed: false,
        }),
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
