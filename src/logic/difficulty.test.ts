import { describe, expect, it } from 'vitest';

import { difficultyLabel, drillDifficulty, threatAttackerArrow } from '@/src/logic/difficulty';
import { clubTacticalWarning, moveOutcome } from '@/src/logic/safety';

describe('difficulty and progressive hint helpers', () => {
  it('classifies starter, club, and sharp positions', () => {
    expect(
      drillDifficulty({
        fen: '4k3/8/8/7q/8/8/8/4K2Q w - - 0 1',
        theme: 'hanging',
        traps: [],
        expectedDropCp: 900,
      }),
    ).toBe('starter');

    expect(
      drillDifficulty({
        fen: '4k3/8/8/8/8/8/5n2/3QK2R w - - 0 1',
        theme: 'fork',
        traps: [],
        expectedDropCp: 500,
      }),
    ).toBe('club');

    expect(
      drillDifficulty({
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b5/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6',
        theme: 'hanging',
        traps: [{ move: 'f1b5', line: ['c6d4'], explanation: 'Black wins the knight.' }],
        expectedDropCp: 300,
      }),
    ).toBe('sharp');

    expect(difficultyLabel('starter')).toBe('Starter');
    expect(difficultyLabel('club')).toBe('Club');
    expect(difficultyLabel('sharp')).toBe('Sharp');
  });

  it('finds the lowest-value direct attacker arrow for progressive hint step 2', () => {
    const arrow = threatAttackerArrow({
      fen: 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
      sideToMove: 'w',
      atRiskSquare: 'h5',
    });
    expect(arrow).toEqual({ from: 'f6', to: 'h5' });
  });
});

describe('clubTacticalWarning (2-ply radar)', () => {
  it('warns when a 1-move-safe move walks into a safe opponent royal fork', () => {
    // White king on e1, rook on a1, black knight on d4.
    // Playing a2-a3 is 1-move-safe (no immediate capture or mate-in-1),
    // yet allows ...Nc2+ forking White's king on e1 and rook on a1 safely!
    const fen = '4k3/8/8/8/3n4/8/P7/R3K3 w - - 0 1';
    expect(moveOutcome(fen, 'a2', 'a3', 'w')).toBe(0);
    const warning = clubTacticalWarning(fen, 'a2', 'a3', 'w');
    expect(warning).toMatch(/Nc2\+.*forks.*king.*rook/i);

    // Moving the king to d2 prevents the c2 fork completely.
    expect(clubTacticalWarning(fen, 'e1', 'd2', 'w')).toBeNull();
  });

  it('does not warn when the forking square is defended by a cheaper/equal piece', () => {
    // White pawn on b3 defends c2? No, b3 attacks a4/c4; white knight on e3 defends c2!
    const fen = '4k3/8/8/8/3n4/4N3/P7/R3K3 w - - 0 1';
    expect(clubTacticalWarning(fen, 'a2', 'a3', 'w')).toBeNull();
  });
});
