import type { StateCreator } from 'zustand';

import { localDateKey } from '@/src/logic/localDate';
import {
  noteSave,
  rememberBankMiss,
  rememberPosition,
  type ReviewEntry,
} from '@/src/logic/reviewPile';
import type { ProgressState } from '@/src/store/progressTypes';

export type ReviewData = {
  missedDate: string | null;
  missedIds: string[];
  review: ReviewEntry[];
};

type ReviewSlice = ReviewData & Pick<ProgressState, 'recordMiss' | 'recordSave' | 'savePersonalDrill'>;

export function initialReview(): ReviewData {
  return { missedDate: null, missedIds: [], review: [] };
}

function withReview(review: ReviewEntry[]): Pick<ReviewData, 'review' | 'missedIds'> {
  return { review, missedIds: review.map((entry) => entry.id) };
}

/** Ids still in the review pile. A previous day does not clear them. */
export function missesForDate(
  missedDate: string | null,
  missedIds: string[],
  today = localDateKey(),
): string[] {
  void missedDate;
  void today;
  return missedIds;
}

export const createReviewSlice: StateCreator<ProgressState, [], [], ReviewSlice> = (set) => ({
  ...initialReview(),
  recordMiss: (drillId, drill) =>
    set((state) => {
      const position = drill ?? state.ownDrills.find((item) => item.id === drillId);
      return withReview(rememberBankMiss(state.review, drillId, position));
    }),
  recordSave: (drillId) => set((state) => withReview(noteSave(state.review, drillId))),
  savePersonalDrill: (drill) => set((state) => withReview(rememberPosition(state.review, drill))),
});
