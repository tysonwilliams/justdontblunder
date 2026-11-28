import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DRILL_PREFS_KEY = 'jdb-drill-prefs-v1';

type DrillPrefsState = {
  /** Null defers to experience level (`intermediate` defaults to unprompted). */
  unprompted: boolean | null;
  blitzTimer: boolean;
  setUnprompted: (value: boolean | null) => void;
  setBlitzTimer: (value: boolean) => void;
};

export const useDrillPrefs = create<DrillPrefsState>()(
  persist(
    (set) => ({
      unprompted: null,
      blitzTimer: false,
      setUnprompted: (unprompted) => set({ unprompted }),
      setBlitzTimer: (blitzTimer) => set({ blitzTimer }),
    }),
    {
      name: DRILL_PREFS_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ unprompted: state.unprompted, blitzTimer: state.blitzTimer }),
    },
  ),
);
