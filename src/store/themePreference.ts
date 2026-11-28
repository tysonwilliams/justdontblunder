import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  THEME_STORAGE_KEY,
  boardThemeFromUnknown,
  initialBoardTheme,
  initialThemePreference,
  preferenceFromUnknown,
  type ThemePreference,
} from '@/src/theme/preference';
import type { BoardTheme } from '@/src/theme/tokens';

type ThemePreferenceState = {
  preference: ThemePreference;
  boardTheme: BoardTheme;
  setPreference: (preference: ThemePreference) => void;
  setBoardTheme: (boardTheme: BoardTheme) => void;
};

export const useThemePreference = create<ThemePreferenceState>()(
  persist(
    (set) => ({
      preference: initialThemePreference(),
      boardTheme: initialBoardTheme(),
      setPreference: (preference) => set({ preference }),
      setBoardTheme: (boardTheme) => set({ boardTheme }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ preference: state.preference, boardTheme: state.boardTheme }),
      merge: (persisted, current) => {
        const record = persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : null;
        const saved = preferenceFromUnknown(record?.preference);
        const savedBoard = boardThemeFromUnknown(record?.boardTheme);
        return {
          ...current,
          preference: saved ?? current.preference,
          boardTheme: savedBoard ?? current.boardTheme,
        };
      },
    },
  ),
);
