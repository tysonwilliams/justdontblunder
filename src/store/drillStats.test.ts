import { describe, expect, it } from 'vitest';

import { applyDrillResult, drillsDoneCount, type DrillTally } from '@/src/store/drillStats';

const empty: DrillTally = {
  drillsCompleted: 0,
  drillsCorrect: 0,
  blundersAvoided: 0,
  blundersMade: 0,
};

describe('drills done', () => {
  it('counts a solved drill and ignores a miss', () => {
    const missed = applyDrillResult(empty, false);
    expect(drillsDoneCount(missed.drillsCorrect)).toBe(0);
    expect(missed.drillsCompleted).toBe(1);
    expect(missed.blundersMade).toBe(1);

    const solved = applyDrillResult(missed, true);
    expect(drillsDoneCount(solved.drillsCorrect)).toBe(1);
    expect(solved.drillsCompleted).toBe(2);
    expect(solved.blundersAvoided).toBe(1);
    expect(Math.round((solved.drillsCorrect / solved.drillsCompleted) * 100)).toBe(50);
  });
});
