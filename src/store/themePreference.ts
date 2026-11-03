import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  THEME_STORAGE_KEY,
  preferenceFromUnknown,
  readStoredThemePreference,
  type ThemePreference,
} from '@/src/theme/preference';

type ThemePreferenceState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const useThemePreference = create<ThemePreferenceState>()(
  persist(
    (set) => ({
      preference: readStoredThemePreference() ?? 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preference: state.preference }),
      merge: (persisted, current) => {
        const saved = preferenceFromUnknown(
          persisted && typeof persisted === 'object' && 'preference' in persisted
            ? (persisted as { preference: unknown }).preference
            : undefined,
        );
        return { ...current, preference: saved ?? current.preference };
      },
    },
  ),
);
