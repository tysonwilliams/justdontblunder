import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { drillTrap, getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { missFeedback, saveFeedback } from '@/src/logic/saveFeedback';
import { moveOutcome, opponentThreatensMateInOne } from '@/src/logic/safety';

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
  ['hang-r-01', 'h4g4'],
  ['hang-r-01', 'h4f4'],
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
  ['hang-r-04', 'd1g4', 'Qg4'],
  ['fork-03', 'b3a4', 'Qa4'],
  ['fork-03', 'b3c4', 'Qc4'],
  ['fork-03', 'b3d3', 'Qd3'],
  ['pin-02', 'd8e7', 'Qe7'],
  ['pin-02', 'd8f6', 'Qf6'],
  ['pin-02', 'd8g5', 'Qg5'],
  ['pin-02', 'd8h4', 'Qh4'],
] as const;

describe('the drill judge', () => {
  it('passes every safe non-trap, rejects every trap, and never accepts a blunder', () => {
    let pass = 0;
    let fail = 0;
    const traps = [];
    for (const item of getAllDrills()) {
      const game = new Chess(item.fen);
      for (const move of game.moves({ verbose: true })) {
        const outcome = moveOutcome(item.fen, move.from, move.to, item.sideToMove);
        const trap = drillTrap(item, move.from, move.to);
        const correct = isCorrectDrillMove(item, move.from, move.to);
        if (correct) pass += 1;
        else fail += 1;
        if (trap) traps.push(trap);

        if (outcome !== null && outcome >= 0 && !trap) {
          expect(correct, `${item.id} ${move.san} should pass`).toBe(true);
        }
        if (trap) {
          expect(correct, `${item.id} ${move.san} is a trap`).toBe(false);
          expect(trap.explanation.startsWith('Careful:'), trap.explanation).toBe(true);
          expect(missFeedback(item, move.from, move.to)).toBe(trap.explanation);
          const line = new Chess(item.fen);
          const played = line.move({ from: move.from, to: move.to, promotion: 'q' });
          expect(played, `${item.id} ${trap.move}`).toBeTruthy();
          for (const uci of trap.line) {
            const reply = line.move({
              from: uci.slice(0, 2) as Square,
              to: uci.slice(2, 4) as Square,
              promotion: 'q',
            });
            expect(reply, `${item.id} ${trap.move} ${uci}`).toBeTruthy();
          }
        }
        if (!correct) continue;
        expect(outcome, `${item.id} ${move.san}`).not.toBeNull();
        expect(outcome!, `${item.id} ${move.san}`).toBeGreaterThanOrEqual(0);
        const after = new Chess(item.fen);
        after.move(move);
        if (after.isCheckmate()) continue;
        expect(opponentThreatensMateInOne(after.fen()), `${item.id} ${move.san} mate`).toBe(false);
      }
    }
    expect(traps).toHaveLength(24);
    expect(pass).toBe(206);
    expect(fail).toBe(739);
  }, 120000);

  it('keeps the disputed material losses as failures', () => {
    expect(DISPUTED).toHaveLength(14);
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

  it('lets hang-b-03 retreats pass unless they are traps', () => {
    expect(ok('hang-b-03', 'f5g6')).toBe(true);
    expect(ok('hang-b-03', 'f5g4')).toBe(true);
    expect(ok('hang-b-03', 'f5e6')).toBe(false);
    expect(ok('hang-b-03', 'f5c8')).toBe(false);
    expect(drillTrap(drill('hang-b-03'), 'f5', 'e6')?.explanation).toMatch(/Be6/);
    expect(drillTrap(drill('hang-b-03'), 'f5', 'c8')?.explanation).toMatch(/Bc8/);
  });

  it('rejects the queen pin and the knight capture that walks into d5', () => {
    expect(ok('hang-q-02', 'd5c6')).toBe(false);
    expect(missFeedback(drill('hang-q-02'), 'd5', 'c6')).toBe(
      'Careful: after Qc6, Bb5 pins your queen to your king and you lose it.',
    );
    expect(ok('fork-06', 'c3e4')).toBe(false);
    expect(missFeedback(drill('fork-06'), 'c3', 'e4')).toMatch(/Nxe4/);
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
