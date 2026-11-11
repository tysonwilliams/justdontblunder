import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { createReviewSession, isCorrectDrillMove } from '@/src/logic/drills';
import { drillFromBlunder, drillFromHang, ownDrillId } from '@/src/logic/personalDrill';

const HANGING_QUEEN = 'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';

describe('personal drills', () => {
  it('saves a hanging piece as a drill the current judge can play', () => {
    const drill = drillFromHang(HANGING_QUEEN);
    expect(drill).toBeTruthy();
    if (!drill) return;
    expect(drill.theme).toBe('hanging');
    expect(drill.atRiskSquare).toBe('h5');
    expect(drill.note).toBe('Your queen on h5 is hanging.');
    expect(drill.id).toBe(ownDrillId(drill.fen));
    expect(isCorrectDrillMove(drill, 'h5', 'e5')).toBe(true);
    expect(isCorrectDrillMove(drill, 'a2', 'a3')).toBe(false);

    const session = createReviewSession([drill.id, 'missing'], undefined, [drill]);
    expect(session.positions.map((item) => item.id)).toEqual([drill.id]);
    expect(createReviewSession([drill.id], 'fork', [drill]).positions).toHaveLength(0);
  });

  it('keeps the position before a blunder and names the capture', () => {
    const game = new Chess(HANGING_QUEEN);
    const played = game.move('a3');
    expect(played).toBeTruthy();
    if (!played) return;
    const drill = drillFromBlunder({
      fen: HANGING_QUEEN,
      from: played.from,
      to: played.to,
      san: played.san,
    });
    expect(drill).toBeTruthy();
    if (!drill) return;
    expect(drill.note).toBe('You played a3. The knight on f6 takes it.');
    expect(drill.theme).toBe('hanging');
    expect(isCorrectDrillMove(drill, 'a2', 'a3')).toBe(false);
    expect(drill.solution.length).toBeGreaterThan(0);
    const save = drill.solution[0];
    expect(save).toBeTruthy();
    if (!save) return;
    expect(isCorrectDrillMove(drill, save.slice(0, 2) as Square, save.slice(2, 4) as Square)).toBe(true);
  });

  it('does not turn a safe move into a drill', () => {
    const start = new Chess().fen();
    const game = new Chess();
    const played = game.move('e4');
    expect(played).toBeTruthy();
    if (!played) return;
    expect(drillFromBlunder({ fen: start, from: played.from, to: played.to, san: played.san })).toBeNull();
    expect(drillFromHang(start)).toBeNull();
  });
});
