import type { Square } from 'chess.js';
import { describe, expect, it, vi } from 'vitest';

import {
  keepMarksAfterDrop,
  marksForDragPress,
  type DragPressInput,
} from '@/src/components/Board/dragSelection';
import { createGame, getLegalTargets } from '@/src/logic/game';

function press(overrides: Partial<DragPressInput> = {}): DragPressInput {
  return {
    phase: 'idle',
    interactive: true,
    squareSize: 48,
    square: 'e2',
    pieceColor: 'w',
    turn: 'w',
    shown: null,
    ...overrides,
  };
}

describe('marksForDragPress', () => {
  it('shows the pressed piece and asks for its legal squares once', () => {
    const game = createGame();
    const targets = vi.fn((square: Square) => getLegalTargets(game, square));
    const decision = marksForDragPress(press(), targets);

    expect(targets).toHaveBeenCalledTimes(1);
    expect(targets).toHaveBeenCalledWith('e2');
    expect(decision.action).toBe('show');
    if (decision.action !== 'show') return;
    expect([...decision.legal].sort()).toEqual(['e3', 'e4']);
    expect(decision.legal).not.toBe(targets.mock.results[0]?.value);
  });

  it('includes a capture square so the board can draw a ring there', () => {
    const game = createGame('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const targets = vi.fn((square: Square) => getLegalTargets(game, square));
    const decision = marksForDragPress(press({ square: 'e4' }), targets);

    expect(targets).toHaveBeenCalledTimes(1);
    expect(decision.action).toBe('show');
    if (decision.action !== 'show') return;
    expect(decision.legal).toEqual(expect.arrayContaining(['d5', 'e5']));
    expect(game.get('d5')).toMatchObject({ color: 'b', type: 'p' });
  });

  it('marks a black piece on black to move', () => {
    const game = createGame();
    expect(game.move('e4')).not.toBeNull();
    const targets = vi.fn((square: Square) => getLegalTargets(game, square));
    const decision = marksForDragPress(press({ square: 'e7', pieceColor: 'b', turn: 'b' }), targets);

    expect(targets).toHaveBeenCalledTimes(1);
    expect(decision.action).toBe('show');
    if (decision.action !== 'show') return;
    expect([...decision.legal].sort()).toEqual(['e5', 'e6']);
  });

  it('shows the corner brackets when the piece has nowhere to go', () => {
    const targets = vi.fn(() => [] as Square[]);
    expect(marksForDragPress(press(), targets)).toEqual({ action: 'show', square: 'e2', legal: [] });
    expect(targets).toHaveBeenCalledTimes(1);
  });

  it('reuses marks already shown for this piece and does not ask again', () => {
    const shown = { square: 'e2' as const, legal: ['e3', 'e4'] as Square[] };
    const targets = vi.fn(() => ['h8'] as Square[]);
    const decision = marksForDragPress(press({ shown }), targets);

    expect(targets).not.toHaveBeenCalled();
    expect(decision).toEqual({ action: 'unchanged', square: 'e2', legal: shown.legal });
    if (decision.action === 'unchanged') expect(decision.legal).toBe(shown.legal);
  });

  it('replaces marks when a different friendly piece is pressed', () => {
    const shown = { square: 'e2' as const, legal: ['e3', 'e4'] as Square[] };
    const targets = vi.fn(() => ['a3', 'c3'] as Square[]);
    const decision = marksForDragPress(press({ square: 'b1', shown }), targets);

    expect(targets).toHaveBeenCalledTimes(1);
    expect(targets).toHaveBeenCalledWith('b1');
    expect(decision).toEqual({ action: 'show', square: 'b1', legal: ['a3', 'c3'] });
  });

  it.each([
    ['a drag already in progress', press({ phase: 'dragging' })],
    ['a piece settling back', press({ phase: 'settling' })],
    ['a board that is not interactive', press({ interactive: false })],
    ['a board that has not been measured', press({ squareSize: 0 })],
    ['a negative square size', press({ squareSize: -8 })],
    ['a point off the board', press({ square: null })],
    ['an empty square', press({ pieceColor: null })],
    ['an opponent piece', press({ square: 'e7', pieceColor: 'b' })],
  ])('ignores %s', (_label, input) => {
    const targets = vi.fn(() => ['e4'] as Square[]);
    expect(marksForDragPress(input, targets)).toEqual({ action: 'ignore' });
    expect(targets).not.toHaveBeenCalled();
  });
});

describe('keepMarksAfterDrop', () => {
  it('keeps the dots when the piece is dropped back on its own square', () => {
    expect(keepMarksAfterDrop({ kind: 'snap', reason: 'origin' })).toBe(true);
  });

  it('clears the dots after a move, an illegal square, or a drop off the board', () => {
    expect(keepMarksAfterDrop({ kind: 'move', to: 'e4' })).toBe(false);
    expect(keepMarksAfterDrop({ kind: 'snap', reason: 'illegal' })).toBe(false);
    expect(keepMarksAfterDrop({ kind: 'snap', reason: 'off-board' })).toBe(false);
  });
});
