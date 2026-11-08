import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_FEEDBACK,
  FEEDBACK_STORAGE_KEY,
  feedbackFromUnknown,
  readStoredFeedback,
} from '@/src/feedback/settings';

type FeedbackSettingsState = {
  sound: boolean;
  haptics: boolean;
  setSound: (sound: boolean) => void;
  setHaptics: (haptics: boolean) => void;
};

const stored = readStoredFeedback();

export const useFeedbackSettings = create<FeedbackSettingsState>()(
  persist(
    (set) => ({
      sound: stored?.sound ?? DEFAULT_FEEDBACK.sound,
      haptics: stored?.haptics ?? DEFAULT_FEEDBACK.haptics,
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: FEEDBACK_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ sound: state.sound, haptics: state.haptics }),
      merge: (persisted, current) => {
        const saved = feedbackFromUnknown(persisted);
        return saved ? { ...current, ...saved } : current;
      },
    },
  ),
);
