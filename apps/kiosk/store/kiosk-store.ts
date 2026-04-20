import { create } from 'zustand';
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

export const useKioskStore = create<KioskState>((set, get) => ({
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

  reset: () => set({ category: null, service: null, ticket: null, idempotencyKey: null }),
}));
