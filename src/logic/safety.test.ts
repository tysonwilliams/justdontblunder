import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { isAbsolutePin } from '@/src/logic/danger';
import { getAllDrills, isCorrectDrillMove } from '@/src/logic/drills';
import { missFeedback } from '@/src/logic/saveFeedback';
import {
  hangingGain,
  materialIsReachable,
  moveOutcome,
  opponentThreatensMateInOne,
} from '@/src/logic/safety';
import { findHangingPieces } from '@/src/engine/patterns';
import { quickPatternFeedback } from '@/src/engine/evaluate';

function drill(id: string) {
  const found = getAllDrills().find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function ok(id: string, uci: string): boolean {
  return isCorrectDrillMove(drill(id), uci.slice(0, 2) as Square, uci.slice(2, 4) as Square);
}

describe('material and pins', () => {
  it('rejects a cloned attacker and a blocked pin line', () => {
    expect(
      materialIsReachable('r1bqkb1r/pppp1ppp/2n2n2/4p3/3nP3/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 6 6'),
    ).toBe(false);
    const blocked = new Chess('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
    expect(isAbsolutePin(blocked, 'c6', 'b')).toBe(false);
    const open = new Chess('r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 1 4');
    expect(isAbsolutePin(open, 'c6', 'b')).toBe(true);
  });
});

describe('the save judge', () => {
  it('accepts the capture on d4 and rejects a queen move that hangs her', () => {
    expect(ok('hang-p-01', 'e5d4')).toBe(true);
    expect(ok('hang-p-01', 'd8g5')).toBe(false);
    expect(moveOutcome(drill('hang-p-01').fen, 'd8', 'g5', 'b')).toBeLessThan(0);
  });

  it('rejects walking into the fork and accepts taking the knight', () => {
    expect(ok('fork-04', 'd1c2')).toBe(true);
    expect(ok('fork-04', 'e1e2')).toBe(false);
    expect(ok('fork-05', 'e1e2')).toBe(false);
    expect(ok('fork-06', 'd2e2')).toBe(false);
    expect(ok('fork-06', 'd3e4')).toBe(true);
  });

  it('rejects scholar moves that lose material and keeps the queen capture', () => {
    expect(ok('mate-01', 'f6h5')).toBe(true);
    expect(ok('mate-01', 'e8e7')).toBe(false);
    expect(ok('mate-01', 'f6d5')).toBe(false);
    expect(ok('mate-01', 'g7g6')).toBe(true);
  });

  it('does not treat a longer mate as the reason to fail mate-02', () => {
    expect(ok('mate-02', 'b8d7')).toBe(true);
    expect(ok('mate-02', 'f7f6')).toBe(true);
    const after = new Chess(drill('mate-02').fen);
    after.move({ from: 'b8', to: 'd7' });
    expect(opponentThreatensMateInOne(after.fen())).toBe(false);
  });

  it('accepts Ke7 when the king keeps the material and accepts d5', () => {
    expect(ok('pin-02', 'e8e7')).toBe(true);
    expect(ok('pin-02', 'd7d5')).toBe(true);
    expect(isAbsolutePin(new Chess(drill('pin-01').fen), 'c6', 'b')).toBe(true);
    expect(isAbsolutePin(new Chess(drill('pin-04').fen), 'c3', 'w')).toBe(true);
  });

  it('explains a miss with the capture, not the hint', () => {
    const text = missFeedback(drill('hang-q-01'), 'h5', 'g4');
    expect(text).toMatch(/wins your queen/);
    expect(text).not.toBe(drill('hang-q-01').note);
  });
});

describe('practice hanging scan', () => {
  it('names the queen when Black plays Bxg4, not a pawn that is also loose', () => {
    const game = new Chess();
    for (const san of ['e4', 'e5', 'd4', 'd5', 'Qg4']) game.move(san);
    const feedback = quickPatternFeedback(game.fen(), 'w');
    expect(feedback.ok).toBe(false);
    expect(feedback.message).toMatch(/queen/);
    const hanging = findHangingPieces(game.fen(), 'w');
    expect(hanging[0]?.message).toMatch(/queen/);
    expect(hangingGain(game.fen(), 'g4', 'w')).toBeGreaterThan(5);
  });
});
