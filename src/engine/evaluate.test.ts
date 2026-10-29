import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { detectPatterns, findHangingPieces } from '@/src/engine/patterns';
import { isBlunder } from '@/src/engine/stockfish';
import { getAllDrills } from '@/src/logic/drills';

describe('isBlunder', () => {
  it('classifies small drops as ok', () => {
    expect(isBlunder(20, 40).severity).toBe('ok');
    expect(isBlunder(20, 40).isBlunder).toBe(false);
  });

  it('classifies medium drops as inaccuracy', () => {
    expect(isBlunder(0, 80).severity).toBe('inaccuracy');
  });

  it('classifies larger drops as mistake / blunder', () => {
    expect(isBlunder(0, 120).severity).toBe('mistake');
    expect(isBlunder(0, 120).isBlunder).toBe(true);
    expect(isBlunder(0, 300).severity).toBe('blunder');
  });
});

describe('pattern detectors', () => {
  it('flags a hanging queen on h4', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const findings = findHangingPieces(fen, 'b');
    expect(findings.some((f) => f.kind === 'hanging' && f.message.includes('queen'))).toBe(
      true,
    );
  });

  it('detects patterns after a side moves', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const findings = detectPatterns(fen, 'b');
    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('beginner fixtures', () => {
  it('has at least 40 drill positions with required fields', () => {
    const drills = getAllDrills();
    expect(drills.length).toBeGreaterThanOrEqual(40);
    for (const drill of drills) {
      expect(drill.id).toBeTruthy();
      expect(drill.fen.split(' ').length).toBeGreaterThanOrEqual(4);
      expect(drill.solution.length).toBeGreaterThan(0);
      expect(drill.note.length).toBeGreaterThan(5);
      expect(typeof drill.expectedDropCp).toBe('number');
    }
  });

  it('solutions are legal moves from the FEN', () => {
    const drills = getAllDrills();
    for (const drill of drills) {
      const game = new Chess(drill.fen);
      const legalUci = game
        .moves({ verbose: true })
        .map((m) => `${m.from}${m.to}${m.promotion ?? ''}`);
      const anyLegal = drill.solution.some((sol) => {
        const base = sol.slice(0, 4);
        return legalUci.some((u) => u.startsWith(base));
      });
      expect(anyLegal, `${drill.id} has no legal solution from FEN`).toBe(true);
    }
  });
});
