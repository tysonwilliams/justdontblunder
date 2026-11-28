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
    expect(drill.note).toBe('You played a3. Nxh5 wins your queen on h5.');
    expect(drill.theme).toBe('hanging');
    expect(isCorrectDrillMove(drill, 'a2', 'a3')).toBe(false);
    expect(drill.solution.length).toBeGreaterThan(0);
    const save = drill.solution[0];
    expect(save).toBeTruthy();
    if (!save) return;
    expect(isCorrectDrillMove(drill, save.slice(0, 2) as Square, save.slice(2, 4) as Square)).toBe(true);
  });

  it('classifies back-rank mate ahead of missed_mate and fork ahead of hanging', () => {
    // White has a back-rank weakness (Kg1 trapped behind f2/g2/h2, Rc1 guarding the 1st rank).
    // Moving Rc1-c2?? leaves the 1st rank open to ...Rd1#.
    const backRankFen = '3r2k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1';
    const backDrill = drillFromBlunder({ fen: backRankFen, from: 'c1', to: 'c2', san: 'Rc2' });
    expect(backDrill).toBeTruthy();
    expect(backDrill?.theme).toBe('back_rank');
    expect(backDrill?.note).toContain('mate');

    // Black knight on e5 forks White's queen on d3 and rook on f3.
    const forkFen = '4k3/8/8/4n3/8/3Q1R2/8/4K3 w - - 0 1';
    const forkDrill = drillFromBlunder({ fen: forkFen, from: 'e1', to: 'e2', san: 'Ke2' });
    expect(forkDrill).toBeTruthy();
    expect(forkDrill?.theme).toBe('fork');
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
