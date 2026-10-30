import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { judgePracticeMove } from '@/src/engine/evaluate';
import { findHangingPieces } from '@/src/engine/patterns';
import { moveOutcome } from '@/src/logic/safety';

function play(sans: string[]): Chess {
  const game = new Chess();
  for (const san of sans) game.move(san);
  return game;
}

function judge(fen: string, from: Square, to: Square) {
  return judgePracticeMove(fen, from, to, 'w');
}

describe('practice move judge', () => {
  it('treats an equal knight trade as a fair trade', () => {
    const game = play(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6']);
    const result = judge(game.fen(), 'd4', 'c6');
    expect(moveOutcome(game.fen(), 'd4', 'c6', 'w')).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Fair trade');
    expect(result.severity).toBe('ok');
    expect(result.squares).toEqual([]);
  });

  it('treats a bishop-for-knight trade as a fair trade', () => {
    const game = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    const result = judge(game.fen(), 'b5', 'c6');
    expect(moveOutcome(game.fen(), 'b5', 'c6', 'w')).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Fair trade');
  });

  it('treats a pawn trade as a fair trade', () => {
    const game = play(['e4', 'd5']);
    const result = judge(game.fen(), 'e4', 'd5');
    expect(moveOutcome(game.fen(), 'e4', 'd5', 'w')).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Fair trade');
  });

  it('treats a capture that wins the queen as clean', () => {
    const fen = 'rnb1kbnr/pp2pppp/2p5/3q4/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 4';
    const result = judge(fen, 'c3', 'd5');
    expect(moveOutcome(fen, 'c3', 'd5', 'w')).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Clean');
    expect(result.message).toMatch(/ahead/);
  });

  it('flags queen for a rook when the queen can be recaptured', () => {
    const fen = 'rn1qkbnr/p1pp1ppp/1p6/r7/Q7/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
    const result = judge(fen, 'a4', 'a5');
    expect(moveOutcome(fen, 'a4', 'a5', 'w')).toBeLessThan(0);
    expect(result.ok).toBe(false);
    expect(result.title).toBe('Hanging piece!');
    expect(result.message).toMatch(/queen/);
  });

  it('flags capturing a defended knight with the queen', () => {
    const fen = 'rnbqkb1r/pppp1ppp/5p2/4n2Q/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
    const result = judge(fen, 'h5', 'e5');
    expect(moveOutcome(fen, 'h5', 'e5', 'w')).toBeLessThan(0);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/queen/);
  });

  it('flags an even-looking trade that leaves another piece hanging', () => {
    const fen = 'r1bqkbnr/ppp2ppp/2np4/Q3n3/8/5N2/PPPPPPPP/RNB1KB1R w KQkq - 0 1';
    const result = judge(fen, 'f3', 'e5');
    expect(moveOutcome(fen, 'f3', 'e5', 'w')).toBeLessThan(0);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/queen/);
  });

  it('does not call a move a blunder only because a later mate exists', () => {
    const result = judge(new Chess().fen(), 'f2', 'f3');
    expect(moveOutcome(new Chess().fen(), 'f2', 'f3', 'w')).toBeGreaterThanOrEqual(0);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('Clean');
  });
});

describe('practice hanging warning', () => {
  it('does not warn when a pawn is attacked and defended', () => {
    const game = play(['e4', 'e5', 'd3', 'd5']);
    expect(findHangingPieces(game.fen(), 'w')).toEqual([]);
  });

  it('warns when a pawn can be taken for a net loss', () => {
    const game = play(['e4', 'd5', 'a3', 'a6']);
    const hanging = findHangingPieces(game.fen(), 'w');
    expect(hanging.some((finding) => finding.squares[0] === 'e4')).toBe(true);
  });
});
