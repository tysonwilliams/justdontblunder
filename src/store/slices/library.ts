import type { StateCreator } from 'zustand';

import type { DrillPosition } from '@/src/logic/drills';
import type { GameProfile } from '@/src/logic/gameImport';
import { PUZZLE_POOL_SIZE, keepOwnDrills, mergeOwnDrills } from '@/src/logic/puzzlePool';
import type { ProgressState } from '@/src/store/progressTypes';

export type LibraryData = {
  gameProfile: GameProfile | null;
  ownDrills: DrillPosition[];
  pastedIds: string[];
};

type LibrarySlice = LibraryData &
  Pick<ProgressState, 'saveGameProfile' | 'saveImportedDrills' | 'mergeImportedDrills'>;

export function initialLibrary(): LibraryData {
  return { gameProfile: null, ownDrills: [], pastedIds: [] };
}

export const createLibrarySlice: StateCreator<ProgressState, [], [], LibrarySlice> = (set) => ({
  ...initialLibrary(),
  saveGameProfile: (profile) => set({ gameProfile: profile }),
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
      return { ownDrills, pastedIds };
    }),
});
