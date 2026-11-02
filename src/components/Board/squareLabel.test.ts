import { describe, expect, it } from 'vitest';

import { squareLabel } from '@/src/components/Board/squareLabel';

describe('squareLabel', () => {
  it('names the piece or an empty square', () => {
    expect(squareLabel('e4', { color: 'w', type: 'p' }, { selected: false, highlighted: false })).toBe(
      'e4, white pawn',
    );
    expect(squareLabel('e5', null, { selected: false, highlighted: false })).toBe('e5, empty');
    expect(squareLabel('b8', { color: 'b', type: 'n' }, { selected: false, highlighted: false })).toBe(
      'b8, black knight',
    );
  });

  it('adds selected and highlighted state', () => {
    expect(squareLabel('e4', { color: 'w', type: 'p' }, { selected: true, highlighted: false })).toBe(
      'e4, white pawn, selected',
    );
    expect(squareLabel('e5', null, { selected: false, highlighted: true })).toBe('e5, empty, highlighted');
    expect(squareLabel('d4', { color: 'b', type: 'q' }, { selected: true, highlighted: true })).toBe(
      'd4, black queen, selected, highlighted',
    );
  });
});
