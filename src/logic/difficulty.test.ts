import { describe, expect, it } from 'vitest';

import { difficultyLabel, drillDifficulty, threatAttackerArrow } from '@/src/logic/difficulty';
import { getAllDrills } from '@/src/logic/drills';
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

  it('distributes the starter bank across Starter, Club, and Sharp tiers', () => {
    const counts = { starter: 0, club: 0, sharp: 0 };
    for (const drill of getAllDrills()) {
      counts[drillDifficulty(drill)] += 1;
    }
    expect(counts.starter).toBeGreaterThan(10);
    expect(counts.club).toBeGreaterThan(10);
    expect(counts.sharp).toBeGreaterThan(10);
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
    const fen = '4k3/8/8/8/3n4/8/P7/R3K3 w - - 0 1';
    expect(moveOutcome(fen, 'a2', 'a3', 'w')).toBe(0);
    const warning = clubTacticalWarning(fen, 'a2', 'a3', 'w');
    expect(warning).toMatch(/Nc2\+.*forks.*king.*rook/i);

    expect(clubTacticalWarning(fen, 'e1', 'd2', 'w')).toBeNull();
  });

  it('detects a capturing royal fork like Nxc2+ when the forking square is supported', () => {
    const captureForkFen = '4k3/8/8/5b2/3nB3/8/2N1Q1PP/R3K3 w - - 0 1';
    const warning = clubTacticalWarning(captureForkFen, 'g2', 'g3', 'w');
    expect(warning).toMatch(/Nxc2\+.*forks/i);
  });

  it('does not warn when the forking square is defended by a cheaper/equal piece', () => {
    const fen = '4k3/8/8/8/3n4/4N3/P7/R3K3 w - - 0 1';
    expect(clubTacticalWarning(fen, 'a2', 'a3', 'w')).toBeNull();
  });
});
