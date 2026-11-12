import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

import {
  mergeProgress,
  migrateProgress,
  partializeProgress,
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  type PersistedProgress,
} from '@/src/store/progressMigrate';
import { progressStorage } from '@/src/store/progressStorage';
import type { ProgressState } from '@/src/store/progressTypes';
import { createLibrarySlice, initialLibrary } from '@/src/store/slices/library';
import { createPreferenceSlice, initialPreferences } from '@/src/store/slices/preferences';
import { createReviewSlice, initialReview } from '@/src/store/slices/review';
import { createScanSlice, initialScan } from '@/src/store/slices/scan';
import { createTrainingSlice, initialTraining } from '@/src/store/slices/training';

export type { Experience, ScanProgress, ThemeTally } from '@/src/store/progressTypes';
export type { PersistedProgress } from '@/src/store/progressMigrate';
export { missesForDate } from '@/src/store/slices/review';

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, ...rest) => ({
      ...createTrainingSlice(set, ...rest),
      ...createReviewSlice(set, ...rest),
      ...createLibrarySlice(set, ...rest),
      ...createPreferenceSlice(set, ...rest),
      ...createScanSlice(set, ...rest),
      resetProgress: () =>
        set({
          ...initialTraining(),
          ...initialReview(),
          ...initialLibrary(),
          ...initialPreferences(),
          ...initialScan(),
        }),
    }),
    {
      name: PROGRESS_STORAGE_KEY,
      version: PROGRESS_VERSION,
      storage: progressStorage as unknown as PersistStorage<PersistedProgress>,
      partialize: partializeProgress,
      migrate: migrateProgress,
      merge: mergeProgress,
    },
  ),
);
