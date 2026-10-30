import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { soundForSan } from '@/src/audio/moveSound';

describe('soundForSan', () => {
  it('uses a move, a capture, then check for a mating line', () => {
    const game = new Chess();
    const quiet = game.move('e4');
    expect(soundForSan(quiet.san)).toBe('move');

    game.move('e5');
    game.move('Bc4');
    game.move('Nc6');
    game.move('Qh5');
    game.move('Nf6');
    const mate = game.move('Qxf7');
    expect(soundForSan(mate.san)).toBe('check');
  });

  it('treats a capture that is not check as a capture', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    const capture = game.move('exd5');
    expect(soundForSan(capture.san)).toBe('capture');
  });
});
