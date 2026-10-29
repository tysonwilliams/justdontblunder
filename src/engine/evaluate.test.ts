import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { detectPatterns, findHangingPieces } from '@/src/engine/patterns';
import { isBlunder } from '@/src/engine/stockfish';
import { createReviewSession, getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { missesForDate } from '@/src/store/progress';

function mateMoves(fen: string): string[] {
  const game = new Chess(fen);
  return game
    .moves({ verbose: true })
    .filter((move) => {
      const next = new Chess(game.fen());
      next.move(move);
      return next.isCheckmate();
    })
    .map((move) => move.san);
}

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
  it('has at least 30 full-board save-your-piece drills with required fields', () => {
    const drills = getAllDrills();
    expect(drills.length).toBeGreaterThanOrEqual(30);
    for (const drill of drills) {
      expect(drill.id).toBeTruthy();
      expect(drill.fen.split(' ').length).toBeGreaterThanOrEqual(4);
      expect(drill.atRiskSquare).toMatch(/^[a-h][1-8]$/);
      expect(drill.solution.length).toBeGreaterThan(0);
      expect(drill.note.length).toBeGreaterThan(5);
      expect(typeof drill.expectedDropCp).toBe('number');
      const pieceCount = drill.fen
        .split(' ')[0]
        .replace(/\d/g, '')
        .replace(/\//g, '').length;
      expect(pieceCount, `${drill.id} too sparse (${pieceCount})`).toBeGreaterThanOrEqual(24);
      const game = new Chess(drill.fen);
      expect(game.turn()).toBe(drill.sideToMove);
      const atRisk = game.get(drill.atRiskSquare);
      expect(atRisk, `${drill.id} missing atRisk piece`).toBeTruthy();
      expect(atRisk?.color).toBe(drill.sideToMove);
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

  it('every drill is immediate danger (hang / fork / absolute pin / mate-in-1)', () => {
    const drills = getAllDrills();
    for (const drill of drills) {
      const game = new Chess(drill.fen);
      const opp = drill.sideToMove === 'w' ? 'b' : 'w';
      const square = drill.atRiskSquare;
      const piece = game.get(square);
      expect(piece, drill.id).toBeTruthy();

      if (drill.theme === 'hanging') {
        expect(game.isAttacked(square, opp), `${drill.id} not attacked`).toBe(true);
      } else if (drill.theme === 'fork') {
        // At-risk unit must be attacked now (fork is live this move).
        expect(game.isAttacked(square, opp), `${drill.id} fork target not attacked`).toBe(
          true,
        );
      } else if (drill.theme === 'pin') {
        expect(game.isAttacked(square, opp), `${drill.id} pin not under attack`).toBe(true);
      } else if (drill.theme === 'back_rank' || drill.theme === 'missed_mate') {
        const parts = drill.fen.split(' ');
        parts[1] = opp;
        const probe = new Chess(parts.join(' '));
        const mates = probe.moves({ verbose: true }).filter((m) => {
          const g = new Chess(probe.fen());
          g.move(m);
          return g.isCheckmate();
        });
        expect(mates.length, `${drill.id} has no mate-in-1 threat`).toBeGreaterThan(0);
      }
    }
  });

  it('builds a review from the ids missed today', () => {
    expect(missesForDate('2026-10-28', ['hang-q-01'], '2026-10-29')).toEqual([]);
    expect(missesForDate('2026-10-29', ['hang-q-01', 'mate-03'], '2026-10-29')).toEqual([
      'hang-q-01',
      'mate-03',
    ]);
    const session = createReviewSession(['hang-q-01', 'missing', 'mate-03']);
    expect(session.positions.map((drill) => drill.id)).toEqual(['hang-q-01', 'mate-03']);
  });

  it('hanging queen on h5 accepts Qxe5 even if that move was left off the list', () => {
    const drill = getAllDrills().find((item) => item.id === 'hang-q-01');
    expect(drill).toBeTruthy();
    if (!drill) return;
    expect(isCorrectDrillMove(drill, 'h5', 'e5')).toBe(true);
    expect(isCorrectDrillMove({ ...drill, solution: [] }, 'h5', 'e5')).toBe(true);
    expect(isCorrectDrillMove(drill, 'h5', 'g4')).toBe(false);
    expect(isCorrectDrillMove(drill, 'h5', 'g6')).toBe(false);
    expect(isCorrectDrillMove(drill, 'h5', 'h6')).toBe(false);
  });

  it("fool's mate drill only accepts moves that stop Qh4#", () => {
    const drill = getAllDrills().find((item) => item.id === 'mate-03');
    expect(drill).toBeTruthy();
    if (!drill) return;
    for (const bad of ['f3f4', 'b1c3', 'c2c3', 'c2c4']) {
      expect(drill.solution, bad).not.toContain(bad);
    }
    for (const good of ['g4g5', 'h2h4', 'e1f2', 'g1h3']) {
      expect(drill.solution, good).toContain(good);
    }
    for (const sol of drill.solution) {
      const game = new Chess(drill.fen);
      game.move({ from: sol.slice(0, 2), to: sol.slice(2, 4) });
      expect(mateMoves(game.fen()), sol).toEqual([]);
    }
  });
});
