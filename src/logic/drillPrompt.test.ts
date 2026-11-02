import { describe, expect, it } from 'vitest';

import { getAllDrills, turnPrompt } from '@/src/logic/drills';

describe('turn prompt', () => {
  it('names whose move it is and does not teach the tactic', () => {
    expect(turnPrompt('w')).toBe('White to move');
    expect(turnPrompt('b')).toBe('Black to move');
    for (const drill of getAllDrills()) {
      const line = turnPrompt(drill.sideToMove);
      expect(line).toBe(drill.sideToMove === 'w' ? 'White to move' : 'Black to move');
      expect(line).not.toMatch(/hanging|fork|pin|mate|blunder|save/i);
    }
  });
});
