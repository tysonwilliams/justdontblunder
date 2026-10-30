import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { isAbsolutePin, isLiveForkOn } from '@/src/logic/danger';
import { getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { hangingGain, materialIsReachable, moveOutcome, opponentThreatensMateInOne } from '@/src/logic/safety';

describe('drill bank', () => {
  it('rejects illegal material, the wrong side, a fake threat, or a move that hangs material or allows mate in 1', () => {
    const ids = new Set<string>();
    for (const drill of getAllDrills()) {
      expect(ids.has(drill.id), drill.id).toBe(false);
      ids.add(drill.id);
      expect(materialIsReachable(drill.fen), `${drill.id} material`).toBe(true);
      const game = new Chess(drill.fen);
      expect(game.turn(), `${drill.id} side`).toBe(drill.sideToMove);

      if (drill.theme === 'hanging') {
        expect(hangingGain(drill.fen, drill.atRiskSquare, drill.sideToMove), drill.id).toBeGreaterThan(0);
      } else if (drill.theme === 'fork') {
        expect(isLiveForkOn(game, drill.atRiskSquare, drill.sideToMove), drill.id).toBe(true);
      } else if (drill.theme === 'pin') {
        expect(isAbsolutePin(game, drill.atRiskSquare, drill.sideToMove), drill.id).toBe(true);
      } else if (drill.theme === 'back_rank' || drill.theme === 'missed_mate') {
        const parts = drill.fen.split(' ');
        parts[1] = drill.sideToMove === 'w' ? 'b' : 'w';
        const probe = new Chess(parts.join(' '));
        expect(opponentThreatensMateInOne(probe.fen()), `${drill.id} mate`).toBe(true);
      } else {
        const _exhaustive: never = drill.theme;
        throw new Error(_exhaustive);
      }

      const accepted: string[] = [];
      for (const move of game.moves({ verbose: true })) {
        if (!isCorrectDrillMove(drill, move.from, move.to)) continue;
        accepted.push(`${move.from}${move.to}`);
        const after = new Chess(drill.fen);
        after.move(move);
        const outcome = moveOutcome(drill.fen, move.from, move.to, drill.sideToMove);
        expect(outcome, `${drill.id} ${move.san}`).not.toBeNull();
        if (after.isCheckmate()) continue;
        expect(outcome, `${drill.id} ${move.san} drops material`).toBeGreaterThanOrEqual(0);
        expect(opponentThreatensMateInOne(after.fen()), `${drill.id} ${move.san} mate`).toBe(false);
      }
      expect(accepted.length, `${drill.id} has no save`).toBeGreaterThan(0);
      for (const uci of drill.acceptable) {
        expect(
          isCorrectDrillMove(drill, uci.slice(0, 2) as Square, uci.slice(2, 4) as Square),
          `${drill.id} ${uci}`,
        ).toBe(true);
      }
    }
  });
});
