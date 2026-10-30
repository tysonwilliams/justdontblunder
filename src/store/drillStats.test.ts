import { describe, expect, it } from 'vitest';

import { applyDrillResult, drillsDoneCount, type DrillTally } from '@/src/store/drillStats';

const empty: DrillTally = {
  drillsCompleted: 0,
  drillsCorrect: 0,
  blundersAvoided: 0,
  blundersMade: 0,
};

describe('drills done', () => {
  it('counts a miss as an answer and a solve as a save', () => {
    const missed = applyDrillResult(empty, false);
    expect(drillsDoneCount(missed.drillsCompleted)).toBe(1);
    expect(missed.drillsCorrect).toBe(0);
    expect(missed.blundersMade).toBe(1);

    const solved = applyDrillResult(missed, true);
    expect(drillsDoneCount(solved.drillsCompleted)).toBe(2);
    expect(solved.drillsCorrect).toBe(1);
    expect(solved.blundersAvoided).toBe(1);
    expect(Math.round((solved.drillsCorrect / solved.drillsCompleted) * 100)).toBe(50);
  });

  it('increments once for every answer, pass or fail', () => {
    let state = empty;
    for (const correct of [true, true, false, true, false, true]) {
      state = applyDrillResult(state, correct);
    }
    expect(state.drillsCompleted).toBe(6);
    expect(drillsDoneCount(state.drillsCompleted)).toBe(6);
    expect(state.drillsCorrect).toBe(4);
    expect(state.blundersAvoided).toBe(4);
    expect(state.blundersMade).toBe(2);
  });
});
