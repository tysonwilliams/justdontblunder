import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { highlightsForRound } from '@/src/components/Board/highlight';
import { getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { roundSpeech, saveFeedback } from '@/src/logic/saveFeedback';
import { moveOutcome } from '@/src/logic/safety';

function drill(id: string) {
  const found = getAllDrills().find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function ok(id: string, uci: string): boolean {
  return isCorrectDrillMove(drill(id), uci.slice(0, 2) as Square, uci.slice(2, 4) as Square);
}

/** Moves the one-move material rule already marks as a loss, so they stay failures. */
const DISPUTED = [
  ['hang-q-01', 'h5g5'],
  ['hang-q-03', 'h4g4'],
  ['hang-p-01', 'd8h4'],
  ['hang-p-01', 'g8f6'],
  ['hang-p-01', 'd7d5'],
  ['fork-01', 'c3a4'],
  ['fork-01', 'c3b5'],
  ['fork-01', 'c3d5'],
  ['fork-01', 'c3b1'],
  ['fork-06', 'c4f7'],
  ['pin-06', 'd4f5'],
  ['pin-06', 'c1g5'],
] as const;

const QUEEN_ESCAPES = [
  ['hang-q-01', 'h5f5', 'Qf5'],
  ['hang-q-03', 'h4h5', 'Qh5'],
  ['hang-q-03', 'h4f4', 'Qf4'],
  ['fork-03', 'b3a4', 'Qa4'],
  ['fork-03', 'b3c4', 'Qc4'],
  ['fork-03', 'b3d3', 'Qd3'],
  ['pin-02', 'd8e7', 'Qe7'],
  ['pin-02', 'd8f6', 'Qf6'],
  ['pin-02', 'd8g5', 'Qg5'],
  ['pin-02', 'd8h4', 'Qh4'],
] as const;

describe('the drill judge', () => {
  it('scores every one-move-safe trap as a save, with a short watch note', () => {
    let traps = 0;
    for (const item of getAllDrills()) {
      for (const trap of item.traps) {
        traps += 1;
        const from = trap.move.slice(0, 2) as Square;
        const to = trap.move.slice(2, 4) as Square;
        const outcome = moveOutcome(item.fen, from, to, item.sideToMove);
        expect(outcome, `${item.id} ${trap.move}`).not.toBeNull();
        expect(outcome!, `${item.id} ${trap.move} is safe on the one-move rule`).toBeGreaterThanOrEqual(0);
        expect(isCorrectDrillMove(item, from, to), `${item.id} ${trap.move}`).toBe(true);
        const copy = roundSpeech('correct', item, { from, to });
        expect(copy, item.id).toMatch(/Safe/);
        expect(copy, item.id).toMatch(/^Your .+ Watch /);
        expect(copy, item.id).not.toMatch(/Careful|miss|blunder|lose/i);
        expect(copy.length, copy).toBeLessThanOrEqual(92);
        expect(highlightsForRound('correct', { from, to }, item.atRiskSquare).tone).toBe('success');
        const line = new Chess(item.fen);
        expect(line.move({ from, to, promotion: 'q' }), `${item.id} ${trap.move}`).toBeTruthy();
        for (const uci of trap.line) {
          const reply = line.move({
            from: uci.slice(0, 2) as Square,
            to: uci.slice(2, 4) as Square,
            promotion: uci[4] === 'r' || uci[4] === 'b' || uci[4] === 'n' ? uci[4] : 'q',
          });
          expect(reply, `${item.id} ${trap.move} ${uci}`).toBeTruthy();
        }
      }
    }
    expect(traps).toBe(24);
  });

  it('keeps the disputed material losses as failures', () => {
    expect(DISPUTED).toHaveLength(12);
    for (const [id, uci] of DISPUTED) {
      const item = drill(id);
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      expect(moveOutcome(item.fen, from, to, item.sideToMove), `${id} ${uci}`).toBeLessThan(0);
      expect(isCorrectDrillMove(item, from, to), `${id} ${uci}`).toBe(false);
    }
  });

  it('accepts the queen escapes the engine window used to fail', () => {
    for (const [id, uci] of QUEEN_ESCAPES) {
      const item = drill(id);
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      expect(moveOutcome(item.fen, from, to, item.sideToMove), `${id} ${uci}`).toBeGreaterThanOrEqual(0);
      expect(isCorrectDrillMove(item, from, to), `${id} ${uci}`).toBe(true);
    }
  });

  it('lets every hang-b-03 retreat pass, including the old traps', () => {
    expect(ok('hang-b-03', 'f5g6')).toBe(true);
    expect(ok('hang-b-03', 'f5g4')).toBe(true);
    expect(ok('hang-b-03', 'f5e6')).toBe(true);
    expect(ok('hang-b-03', 'f5c8')).toBe(true);
    expect(roundSpeech('correct', drill('hang-b-03'), { from: 'f5', to: 'e6' })).toMatch(/Watch e5/);
    expect(roundSpeech('correct', drill('hang-b-03'), { from: 'f5', to: 'c8' })).toMatch(/Watch exd5/);
  });

  it('scores the queen step to c6 as a save and still rejects a one-move loss', () => {
    expect(ok('hang-q-02', 'd5c6')).toBe(true);
    expect(roundSpeech('correct', drill('hang-q-02'), { from: 'd5', to: 'c6' })).toBe(
      'Your queen steps off d5. Safe. Watch Bb5.',
    );
    expect(ok('fork-06', 'c3e4')).toBe(true);
    expect(roundSpeech('correct', drill('fork-06'), { from: 'c3', to: 'e4' })).toMatch(/Watch d5/);
    expect(ok('back-01', 'b8d7')).toBe(true);
    expect(ok('back-01', 'f7f6')).toBe(true);
    expect(ok('back-01', 'g7g6')).toBe(true);
    expect(ok('back-01', 'h7h6')).toBe(true);
    expect(ok('back-01', 'h7h5')).toBe(true);
  });

  it('adds a stronger-move note without turning the save into a miss', () => {
    expect(ok('fork-01', 'a2a3')).toBe(true);
    expect(ok('hang-q-01', 'h5f5')).toBe(true);
    expect(saveFeedback(drill('fork-01'), 'a2', 'a3')).toBe(
      'a3 breaks the fork. Safe! Nxd4 was even stronger.',
    );
    expect(saveFeedback(drill('hang-q-01'), 'h5', 'f5')).toBe(
      'Qf5 gets your queen off h5. Safe! Qxe5+ was even stronger.',
    );
    expect(saveFeedback(drill('hang-q-01'), 'h5', 'e5')).toBe(
      'Qxe5+ takes the pawn and gets your queen off h5.',
    );
  });
});
