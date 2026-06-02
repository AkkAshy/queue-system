import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ShiftInit {
  userId: number;
  userName: string;
  counterId: number;
  counterNumber: string;
  counterName: string;
  sessionId: number;
}

interface OperatorState {
  userId: number | null;
  userName: string | null;
  counterId: number | null;
  counterNumber: string | null;
  counterName: string | null;
  sessionId: number | null;
  onBreak: boolean;

  startShift: (init: ShiftInit) => void;
  setOnBreak: (v: boolean) => void;
  logout: () => void;
  isSignedIn: () => boolean;
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set, get) => ({
      userId: null,
      userName: null,
      counterId: null,
      counterNumber: null,
      counterName: null,
      sessionId: null,
      onBreak: false,

      startShift: (init) =>
        set({
          userId: init.userId,
          userName: init.userName,
          counterId: init.counterId,
          counterNumber: init.counterNumber,
          counterName: init.counterName,
          sessionId: init.sessionId,
          onBreak: false,
        }),

      setOnBreak: (v) => set({ onBreak: v }),

      logout: () =>
        set({
          userId: null,
          userName: null,
          counterId: null,
          counterNumber: null,
          counterName: null,
          sessionId: null,
          onBreak: false,
        }),

      isSignedIn: () => {
        const s = get();
        return s.userId !== null && s.counterId !== null && s.sessionId !== null;
      },
    }),
    {
      name: 'operator-shift',
      storage: createJSONStorage(() =>
        typeof window === 'undefined'
          ? (undefined as unknown as Storage)
          : window.sessionStorage,
      ),
    },
  ),
);
