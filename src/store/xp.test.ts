import { describe, expect, it } from 'vitest';

import { XP_PER_SAFE_MOVE, xpAfterAward } from '@/src/store/xp';

describe('xpAfterAward', () => {
  it('adds points for a safe move and leaves a blunder unchanged', () => {
    expect(XP_PER_SAFE_MOVE).toBe(10);
    expect(xpAfterAward(0, true)).toBe(10);
    expect(xpAfterAward(10, false)).toBe(10);
    expect(xpAfterAward(10, true)).toBe(20);
  });
});
