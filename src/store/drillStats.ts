export type DrillTally = {
  drillsCompleted: number;
  drillsCorrect: number;
  blundersAvoided: number;
  blundersMade: number;
};

/**
 * `drillsCompleted` is attempts, so accuracy can stay correct/attempted.
 * "Drills done" reads `drillsCorrect` — a miss is not a solved drill.
 */
export function applyDrillResult(state: DrillTally, correct: boolean): DrillTally {
  return {
    drillsCompleted: state.drillsCompleted + 1,
    drillsCorrect: state.drillsCorrect + (correct ? 1 : 0),
    blundersAvoided: state.blundersAvoided + (correct ? 1 : 0),
    blundersMade: state.blundersMade + (correct ? 0 : 1),
  };
}

export function drillsDoneCount(drillsCorrect: number): number {
  return drillsCorrect;
}
