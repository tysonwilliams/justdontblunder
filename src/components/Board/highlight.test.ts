import { describe, expect, it } from 'vitest';

import { highlightsForRound, legalMoveInk, squareBackground } from '@/src/components/Board/highlight';
import { colors } from '@/src/theme';

const quiet = {
  isDark: true,
  isLast: false,
  isAttention: false,
  isSelected: false,
  isHighlight: false,
  highlightTone: 'danger' as const,
};

describe('squareBackground', () => {
  it('paints a correct save green, including the last-move square', () => {
    const fill = squareBackground({
      ...quiet,
      isLast: true,
      isHighlight: true,
      highlightTone: 'success',
    });
    expect(fill).toBe(colors.boardSave);
    expect(fill).not.toBe(colors.boardBlunder);
  });

  it('keeps blunder highlights red', () => {
    expect(
      squareBackground({ ...quiet, isLast: true, isHighlight: true, highlightTone: 'danger' }),
    ).toBe(colors.boardBlunder);
  });

  it('leaves an unmarked last-move square on the neutral last-move color', () => {
    expect(squareBackground({ ...quiet, isLast: true })).toBe(colors.boardLastMove);
  });
});

describe('legalMoveInk', () => {
  it('uses the grey-blue move dot for captures, not blunder red', () => {
    expect(legalMoveInk(true)).toBe(colors.boardLegalOnDark);
    expect(legalMoveInk(false)).toBe(colors.boardLegalOnLight);
    expect(legalMoveInk(true)).not.toBe(colors.boardBlunder);
    expect(legalMoveInk(false)).not.toBe(colors.danger);
    expect(legalMoveInk(true)).not.toBe(colors.boardCaptureOnDark);
    expect(legalMoveInk(false)).not.toBe(colors.boardCaptureOnLight);
  });
});

describe('highlightsForRound', () => {
  const move = { from: 'h5' as const, to: 'e5' as const };

  it('marks both squares of a correct save as a success, not a blunder', () => {
    expect(highlightsForRound('correct', move, 'h5')).toEqual({
      squares: ['h5', 'e5'],
      tone: 'success',
    });
  });

  it('marks a miss in red, including the piece that is still in danger', () => {
    expect(highlightsForRound('streakEnd', { from: 'h5', to: 'g4' }, 'h5')).toEqual({
      squares: ['h5', 'g4'],
      tone: 'danger',
    });
    expect(highlightsForRound('retry', { from: 'h5', to: 'g4' }, 'h5').tone).toBe('danger');
  });

  it('shows a revealed solution in green and a miss hint square in red when no move was played', () => {
    expect(highlightsForRound('revealed', move, 'h5').tone).toBe('success');
    expect(highlightsForRound('revealed', null, 'h5')).toEqual({
      squares: ['h5'],
      tone: 'danger',
    });
  });
});
