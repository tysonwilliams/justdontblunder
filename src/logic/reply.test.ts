import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { chooseBlackReply, PRACTICE_OPPONENT_ELO } from '@/src/logic/reply';
import { hangingGain } from '@/src/logic/safety';

describe('chooseBlackReply', () => {
  it('develops against an early pawn move', () => {
    const reply = chooseBlackReply(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(reply?.san).toBe('e5');
  });

  it('takes a hanging queen instead of developing', () => {
    const reply = chooseBlackReply(
      'rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 2 3',
    );
    expect(reply?.from).toBe('f6');
    expect(reply?.to).toBe('h5');
  });

  it('does nothing when it is white to move', () => {
    expect(
      chooseBlackReply('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toBeNull();
  });

  it('sits around club-beginner strength', () => {
    expect(PRACTICE_OPPONENT_ELO).toBeGreaterThanOrEqual(1000);
    expect(PRACTICE_OPPONENT_ELO).toBeLessThanOrEqual(1200);
  });

  it('captures a free rook', () => {
    const reply = chooseBlackReply(
      'rnbqkbnr/ppp1pppp/8/8/3R4/8/PPPPPPPP/RNBQKBN1 b Qkq - 0 1',
    );
    expect(reply?.to).toBe('d4');
    expect(reply?.san).toMatch(/x/);
  });

  it('plays mate in 1', () => {
    const reply = chooseBlackReply(
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    );
    expect(reply?.san).toBe('Qh4#');
  });

  it('moves a queen off d5 when a knight attacks it', () => {
    const game = new Chess();
    for (const san of ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3']) game.move(san);
    const reply = chooseBlackReply(game.fen());
    expect(reply).toBeTruthy();
    const after = new Chess(game.fen());
    after.move({ from: reply!.from, to: reply!.to });
    const queen = after.board().flat().find((piece) => piece?.type === 'q' && piece.color === 'b');
    expect(queen).toBeTruthy();
    if (after.get('d5')?.type === 'q') {
      expect(hangingGain(after.fen(), 'd5', 'b')).toBeLessThanOrEqual(0);
    }
    expect(reply?.san).not.toBe('Nf6');
  });

  it('does not leave the bishop on g4 to a pawn', () => {
    const game = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'Bg4', 'h3']) {
      game.move(san);
    }
    const reply = chooseBlackReply(game.fen());
    expect(reply).toBeTruthy();
    const after = new Chess(game.fen());
    after.move({ from: reply!.from, to: reply!.to });
    if (after.get('g4')?.type === 'b' && after.get('g4')?.color === 'b') {
      expect(hangingGain(after.fen(), 'g4', 'b')).toBeLessThanOrEqual(0);
    }
  });

  it('does not develop the queen on move 2', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    const reply = chooseBlackReply(game.fen());
    expect(reply?.san.startsWith('Q')).toBe(false);
  });
});