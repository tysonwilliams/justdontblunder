import { describe, expect, it } from 'vitest';

import { chooseBlackReply } from '@/src/logic/reply';

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
});