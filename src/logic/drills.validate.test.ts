import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { isAbsolutePin, isLiveForkOn } from '@/src/logic/danger';
import { getAllDrills, isCorrectDrillMove, type DrillTheme } from '@/src/logic/drills';
import { fenKey } from '@/src/logic/reviewPile';
import { hangingGain, materialIsReachable, moveOutcome, opponentThreatensMateInOne } from '@/src/logic/safety';

/** A silent sweep longer than 60s makes Vitest drop the worker call that reports the result. */
function breathe(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

const THEMES: readonly DrillTheme[] = ['hanging', 'fork', 'pin', 'back_rank', 'missed_mate'];

describe('drill bank', () => {
  it(
    'keeps 150 unique reachable puzzles, balanced by theme, each with a blunder and a save',
    async () => {
      const drills = getAllDrills();
      expect(drills.length).toBeGreaterThanOrEqual(150);
      const ids = new Set<string>();
      const fens = new Set<string>();
      const themes: Record<DrillTheme, number> = {
        hanging: 0,
        fork: 0,
        pin: 0,
        back_rank: 0,
        missed_mate: 0,
      };
      for (const drill of drills) {
        await breathe();
        expect(ids.has(drill.id), drill.id).toBe(false);
        ids.add(drill.id);
        const key = fenKey(drill.fen);
        expect(fens.has(key), `${drill.id} duplicate fen`).toBe(false);
        fens.add(key);
        themes[drill.theme] += 1;
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

        let saves = 0;
        let blunders = 0;
        const moves = game.moves({ verbose: true });
        for (let index = 0; index < moves.length; index += 1) {
          if (index % 8 === 0) await breathe();
          const move = moves[index]!;
          const outcome = moveOutcome(drill.fen, move.from, move.to, drill.sideToMove);
          const correct = outcome !== null && outcome >= 0;
          expect(isCorrectDrillMove(drill, move.from, move.to), `${drill.id} ${move.san}`).toBe(correct);
          if (!correct) {
            if (outcome !== null && outcome < 0) blunders += 1;
            continue;
          }
          saves += 1;
          const after = new Chess(drill.fen);
          after.move(move);
          if (after.isCheckmate()) continue;
          expect(opponentThreatensMateInOne(after.fen()), `${drill.id} ${move.san} mate`).toBe(false);
        }
        expect(saves, `${drill.id} has no save`).toBeGreaterThan(0);
        expect(blunders, `${drill.id} has no one-move blunder`).toBeGreaterThan(0);
        for (const uci of drill.acceptable) {
          expect(
            isCorrectDrillMove(drill, uci.slice(0, 2) as Square, uci.slice(2, 4) as Square),
            `${drill.id} ${uci}`,
          ).toBe(true);
        }
      }
      const counts = THEMES.map((theme) => themes[theme]);
      const min = Math.min(...counts);
      const max = Math.max(...counts);
      expect(min).toBeGreaterThanOrEqual(30);
      expect(max - min).toBeLessThanOrEqual(4);
    },
    600_000,
  );
});
