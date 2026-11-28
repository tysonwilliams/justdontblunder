import type { StateCreator } from 'zustand';

import type { DrillPosition } from '@/src/logic/drills';
import type { GameProfile } from '@/src/logic/gameImport';
import { PUZZLE_POOL_SIZE, keepOwnDrills, mergeOwnDrills } from '@/src/logic/puzzlePool';
import { enrollImportedReviews } from '@/src/logic/reviewPile';
import type { ProgressState } from '@/src/store/progressTypes';

import { initialScan } from '@/src/store/slices/scan';

export type LibraryData = {
  gameProfile: GameProfile | null;
  ownDrills: DrillPosition[];
  pastedIds: string[];
};

type LibrarySlice = LibraryData &
  Pick<ProgressState, 'saveGameProfile' | 'clearGameProfile' | 'saveImportedDrills' | 'mergeImportedDrills'>;

export function initialLibrary(): LibraryData {
  return { gameProfile: null, ownDrills: [], pastedIds: [] };
}

export const createLibrarySlice: StateCreator<ProgressState, [], [], LibrarySlice> = (set) => ({
  ...initialLibrary(),
  saveGameProfile: (profile) => set({ gameProfile: profile }),
  clearGameProfile: () => set({ gameProfile: null, ...initialScan() }),
  saveImportedDrills: (drills) => set({ ownDrills: keepOwnDrills(drills, PUZZLE_POOL_SIZE) }),
  mergeImportedDrills: (drills) =>
    set((state) => {
      const ownDrills = mergeOwnDrills(state.ownDrills, drills, PUZZLE_POOL_SIZE);
      const live = new Set(ownDrills.map((item) => item.id));
      const pastedIds: string[] = [];
      const seen = new Set<string>();
      for (const id of [...state.pastedIds, ...drills.map((item) => item.id)]) {
        if (!live.has(id) || seen.has(id)) continue;
        seen.add(id);
        pastedIds.push(id);
      }
      const review = drills.length > 0 ? enrollImportedReviews(state.review, drills) : state.review;
      return { ownDrills, pastedIds, review, missedIds: review.map((entry) => entry.id) };
    }),
});
