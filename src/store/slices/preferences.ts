import type { StateCreator } from 'zustand';

import type { Experience, ProgressState } from '@/src/store/progressTypes';

export type PreferenceData = {
  experience: Experience | null;
  welcomeSkipped: boolean;
  drillsPromptSkipped: boolean;
};

type PreferenceSlice = PreferenceData &
  Pick<ProgressState, 'setExperience' | 'skipWelcome' | 'skipDrillsPrompt'>;

export function initialPreferences(): PreferenceData {
  return { experience: null, welcomeSkipped: false, drillsPromptSkipped: false };
}

export const createPreferenceSlice: StateCreator<ProgressState, [], [], PreferenceSlice> = (set) => ({
  ...initialPreferences(),
  setExperience: (value) => set({ experience: value, welcomeSkipped: false }),
  skipWelcome: () => set({ welcomeSkipped: true }),
  skipDrillsPrompt: () => set({ drillsPromptSkipped: true }),
});
