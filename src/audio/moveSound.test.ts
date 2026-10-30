import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

import { soundForSan } from '@/src/audio/moveSound';

describe('soundForSan', () => {
  it('uses move for quiet plays and capture for checks and takes', () => {
    const game = new Chess();
    const quiet = game.move('e4');
    expect(soundForSan(quiet.san)).toBe('move');

    game.move('e5');
    game.move('Bc4');
    game.move('Nc6');
    game.move('Qh5');
    game.move('Nf6');
    const mate = game.move('Qxf7');
    expect(soundForSan(mate.san)).toBe('capture');
  });

  it('treats a capture that is not check as a capture', () => {
    const game = new Chess();
    game.move('e4');
    game.move('d5');
    const capture = game.move('exd5');
    expect(soundForSan(capture.san)).toBe('capture');
  });

  it('treats check without capture as capture sound', () => {
    expect(soundForSan('Qh5+')).toBe('capture');
    expect(soundForSan('Nf7#')).toBe('capture');
  });
});
