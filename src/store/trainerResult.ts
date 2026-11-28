import type { DrillPosition } from '@/src/logic/drills';
import { localDateKey } from '@/src/logic/localDate';
import { reviewId, reviewMiss } from '@/src/logic/puzzlePool';
import { isDue } from '@/src/logic/reviewSchedule';
import type { TrainerEffect } from '@/src/logic/trainerRound';
import { useProgressStore } from '@/src/store/progress';

/** One saved outcome. A review save schedules the next gap. A miss is due again today. */
export function persistTrainerResult(correct: boolean, drill: DrillPosition, reviewing: boolean): void {
  const store = useProgressStore.getState();
  store.markDrillResult(correct, drill.theme);
  if (correct) {
    if (reviewing) {
      store.recordSave(drill.id);
      return;
    }
    const id = reviewId(drill.id);
    const dueEntry = store.review.find((entry) => entry.id === id);
    if (dueEntry && isDue(dueEntry, localDateKey())) {
      store.recordSave(id);
    }
    return;
  }
  const miss = reviewMiss(drill);
  store.recordMiss(miss.id, miss.drill);
}

export function applyRoundEffects(
  effects: readonly TrainerEffect[],
  drill: DrillPosition | undefined,
  reviewing: boolean,
): void {
  const store = useProgressStore.getState();
  for (const effect of effects) {
    switch (effect.type) {
      case 'recordResult':
        if (drill) persistTrainerResult(effect.correct, drill, reviewing);
        break;
      case 'recordRun':
        store.recordPuzzleRun(effect.length);
        break;
      default: {
        const _exhaustive: never = effect;
        return _exhaustive;
      }
    }
  }
}
