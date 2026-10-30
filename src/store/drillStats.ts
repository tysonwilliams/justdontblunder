export type DrillTally = {
  drillsCompleted: number;
  drillsCorrect: number;
  blundersAvoided: number;
  blundersMade: number;
};

/**
 * Every answer increments `drillsCompleted` once.
 * `drillsCorrect` and the save / blunder tallies follow pass vs fail.
 */
export function applyDrillResult(state: DrillTally, correct: boolean): DrillTally {
  return {
    drillsCompleted: state.drillsCompleted + 1,
    drillsCorrect: state.drillsCorrect + (correct ? 1 : 0),
    blundersAvoided: state.blundersAvoided + (correct ? 1 : 0),
    blundersMade: state.blundersMade + (correct ? 0 : 1),
  };
}

/** Drills played, including misses. Accuracy is correct / this count. */
export function drillsDoneCount(drillsCompleted: number): number {
  return drillsCompleted;
}
