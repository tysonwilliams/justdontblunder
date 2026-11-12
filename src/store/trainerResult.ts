import type { DrillPosition } from '@/src/logic/drills';
import { reviewMiss } from '@/src/logic/puzzlePool';
import type { TrainerEffect } from '@/src/logic/trainerRound';
import { useProgressStore } from '@/src/store/progress';

/** One saved outcome. A review save graduates the pile. A miss keeps the position. */
export function persistTrainerResult(correct: boolean, drill: DrillPosition, reviewing: boolean): void {
  const store = useProgressStore.getState();
  store.markDrillResult(correct, drill.theme);
  if (correct) {
    if (reviewing) store.recordSave(drill.id);
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
