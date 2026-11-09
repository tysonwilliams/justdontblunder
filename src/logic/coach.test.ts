import { describe, expect, it } from 'vitest';

import { coachForRound, coachSpeech } from '@/src/logic/coach';

const HANGING_KNIGHT = 'b3k3/8/8/8/8/5N2/P7/4K3 w - - 0 1';
const MATE_THREAT = '6k1/8/8/8/8/8/r4PPP/6K1 w - - 0 1';
const GUARDED_ROOK = '4k3/8/8/1p6/R7/1P6/8/4K3 w - - 0 1';

describe('coachSpeech', () => {
  it('says which piece is lost and which piece takes it', () => {
    const line = coachSpeech({ kind: 'blunder', fen: HANGING_KNIGHT, from: 'a2', to: 'a3' });
    expect(line).toBe('Your knight on f3 is undefended — the bishop takes it.');
    expect(line.length).toBeLessThanOrEqual(92);
  });

  it('calls a safe step off the loose square a save', () => {
    const line = coachSpeech({ kind: 'save', fen: HANGING_KNIGHT, from: 'f3', to: 'd4' });
    expect(line).toBe('Your knight steps off f3. Safe.');
  });

  it('names a capture that gets the piece out of trouble', () => {
    const fen = '4k3/8/8/4p3/8/5N2/8/4K3 w - - 0 1';
    const line = coachSpeech({ kind: 'save', fen, from: 'f3', to: 'e5' });
    expect(line).toBe('Your knight takes the pawn. Safe.');
  });

  it('describes a mate threat in plain words', () => {
    const line = coachSpeech({ kind: 'blunder', fen: MATE_THREAT, from: 'g1', to: 'h1' });
    expect(line).toBe("That's mate. The rook on a2 can reach your king.");
    expect(line.length).toBeLessThanOrEqual(92);
  });

  it('says a guarded piece is not safe when the trade still loses', () => {
    const line = coachSpeech({ kind: 'blunder', fen: GUARDED_ROOK, from: 'e1', to: 'e2' });
    expect(line).toBe("Your rook on a4 isn't safe — the pawn takes it.");
    expect(line.length).toBeLessThanOrEqual(92);
  });
});

describe('coachForRound', () => {
  it('keeps the lesson note when the round is showing the idea', () => {
    expect(coachForRound('idea', HANGING_KNIGHT, { from: 'a2', to: 'a3' }, 'Step the knight away.')).toBe(
      'Step the knight away.',
    );
    expect(coachForRound('blunder', HANGING_KNIGHT, null, 'Step the knight away.')).toBe('Step the knight away.');
  });
});
